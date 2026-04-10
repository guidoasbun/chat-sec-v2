using Amazon.DynamoDBv2;
using ChatSec.API.Middleware;
using ChatSec.API.Services;
using StackExchange.Redis;
using ChatSec.API.Hubs;

var builder = WebApplication.CreateBuilder(args);

// ── Controllers ──────────────────────────────────────────────────────────────
// Registers all classes in Controllers/ as HTTP endpoint handlers
builder.Services.AddControllers();

// ── CORS ─────────────────────────────────────────────────────────────────────
// Cross-Origin Resource Sharing — allows the Next.js frontend (different port)
// to call this API. In production, CorsOrigin will be your real domain.
var corsOrigin = builder.Configuration["App:CorsOrigin"]
    ?? throw new InvalidOperationException("App:CorsOrigin is not configured.");

builder.Services.AddCors(options =>
{
    options.AddPolicy("FrontendPolicy", policy =>
    {
        policy.WithOrigins(corsOrigin)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials(); // Required for SignalR WebSocket handshake
    });
});

// ── AWS Services ──────────────────────────────────────────────────────────────
// AWSSDK.Extensions.NETCore.Setup reads the AWS region from appsettings.json.
// In Development, DynamoDbServiceUrl points to Docker. In production, the SDK
// uses the ECS Task Role automatically — no credentials needed in code.

// In development, point DynamoDB at the local Docker container.
// In production, no ServiceURL is set so the SDK uses the ECS Task Role automatically.
var dynamoDbServiceUrl = builder.Configuration["AWS:DynamoDbServiceUrl"];

if (!string.IsNullOrEmpty(dynamoDbServiceUrl))
{
    builder.Services.AddSingleton<IAmazonDynamoDB>(_ =>
        new AmazonDynamoDBClient(new AmazonDynamoDBConfig
        {
            ServiceURL          = dynamoDbServiceUrl,
            AuthenticationRegion = builder.Configuration["AWS:Region"] ?? "us-east-1"
        }));
}
else
{
    builder.Services.AddAWSService<IAmazonDynamoDB>();
}


// ── Application Services ──────────────────────────────────────────────────────
// Registers our own service classes. AddScoped means one instance per HTTP request.
builder.Services.AddScoped<DynamoDbService>();

// ── SignalR + Redis Backplane ─────────────────────────────────────────────────
// SignalR handles WebSocket connections for real-time messaging.
// The Redis backplane lets messages route across multiple containers —
// without it, a user on container A can't receive a message sent from container B.
var redisConnection = builder.Configuration["App:RedisConnectionString"];

var signalRBuilder = builder.Services.AddSignalR();
if (!string.IsNullOrEmpty(redisConnection))
{
    signalRBuilder.AddStackExchangeRedis(redisConnection);
}

// ── Redis Connection ──────────────────────────────────────────────────────────
// IConnectionMultiplexer is the StackExchange.Redis connection — shared as a
// singleton because opening connections is expensive. OnlineUserService uses this
// to read/write the online_users set directly (separate from the SignalR backplane).
if (!string.IsNullOrEmpty(redisConnection))
{
    builder.Services.AddSingleton<IConnectionMultiplexer>(
        ConnectionMultiplexer.Connect(redisConnection));
}
builder.Services.AddSingleton<OnlineUserService>();

// ── Authentication ────────────────────────────────────────────────────────────
// Validates JWT tokens issued by AWS Cognito on every protected request.
// The token contains the user's identity — we never store passwords ourselves.
var cognitoRegion = builder.Configuration["AWS:Region"];
var cognitoUserPoolId = builder.Configuration["AWS:CognitoUserPoolId"];

if (!string.IsNullOrEmpty(cognitoUserPoolId))
{
    builder.Services.AddAuthentication("Bearer")
        .AddJwtBearer("Bearer", options =>
        {
            options.Authority = $"https://cognito-idp.{cognitoRegion}.amazonaws.com/{cognitoUserPoolId}";
            options.TokenValidationParameters = new()
            {
                ValidateIssuerSigningKey = true,
                ValidateIssuer = true,
                ValidateAudience = false // Cognito access tokens don't include audience
            };
        });

    builder.Services.AddAuthorization();
}

// ── Build ─────────────────────────────────────────────────────────────────────
var app = builder.Build();

// ── Middleware Pipeline ───────────────────────────────────────────────────────
// Order matters — each request passes through these in sequence, top to bottom.

app.UseMiddleware<GlobalExceptionMiddleware>(); // Catches unhandled exceptions first
app.UseCors("FrontendPolicy");                 // Apply CORS headers before routing
app.UseMiddleware<InputSanitizationMiddleware>(); // Sanitize input before it hits controllers

if (!string.IsNullOrEmpty(cognitoUserPoolId))
{
    app.UseAuthentication(); // Validate JWT token
    app.UseAuthorization();  // Check if user has permission
}

app.MapControllers();  // Route HTTP requests to controller methods
app.MapHub<ChatHub>("/hubs/chat"); // Uncomment when ChatHub.cs is created

app.Run();
