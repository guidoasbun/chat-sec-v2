using Microsoft.AspNetCore.Mvc;
using ChatSec.API.Models;
using ChatSec.API.Models.DTOs;
using ChatSec.API.Services;

namespace ChatSec.API.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly DynamoDbService _db;
    private readonly CognitoService _cognito;
    private readonly ILogger<AuthController> _logger;

    public AuthController(DynamoDbService db, CognitoService cognito, ILogger<AuthController> logger)
    {
        _db      = db;
        _cognito = cognito;
        _logger  = logger;
    }

    // POST /api/auth/register
    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Username) ||
            string.IsNullOrWhiteSpace(request.Password) ||
            string.IsNullOrWhiteSpace(request.Email) ||
            string.IsNullOrWhiteSpace(request.PublicKey) ||
            string.IsNullOrWhiteSpace(request.SigningPublicKey))
        {
            return BadRequest(new { error = "All fields are required." });
        }

        // Check username is not already taken
        var existing = await _db.GetUserByUsernameAsync(request.Username);
        if (existing != null)
        {
            return Conflict(new { error = "Username already exists." });
        }

        // Create user in Cognito — returns the Cognito sub (UUID) which is our userId
        var userId = await _cognito.SignUpAsync(request.Email, request.Password);

        // Auto-confirm so the user can log in immediately (skips email verification)
        await _cognito.AdminConfirmSignUpAsync(request.Email);

        var user = new User
        {
            UserId          = userId,
            Username        = request.Username,
            Email           = request.Email,
            PublicKey       = request.PublicKey,
            SigningPublicKey = request.SigningPublicKey,
            CreatedAt       = DateTime.UtcNow.ToString("o")
        };

        await _db.PutUserAsync(user);

        _logger.LogInformation("Registered user {Username} with Cognito sub {UserId}", user.Username, user.UserId);

        return Ok(new { userId, message = "Registration successful." });
    }

    // POST /api/auth/login
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Username) ||
            string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(new { error = "Username and password are required." });
        }

        // Look up the user by display username to get their email (Cognito login identifier)
        var user = await _db.GetUserByUsernameAsync(request.Username);
        if (user == null)
        {
            return Unauthorized(new { error = "Invalid username or password." });
        }

        // Cognito validates the password and issues a signed JWT Access Token
        string accessToken;
        try
        {
            accessToken = await _cognito.InitiateAuthAsync(user.Email, request.Password);
        }
        catch (Exception)
        {
            // Same message whether user doesn't exist or password is wrong — prevents username enumeration
            return Unauthorized(new { error = "Invalid username or password." });
        }

        // Store the real Cognito JWT in an HttpOnly cookie
        // HttpOnly = JavaScript cannot read it (XSS protection)
        // Secure = only sent over HTTPS
        // SameSite=Strict = not sent on cross-site requests (CSRF protection)
        Response.Cookies.Append("auth_token", accessToken, new CookieOptions
        {
            HttpOnly = true,
            Secure   = true,
            SameSite = SameSiteMode.Strict,
            Expires  = DateTimeOffset.UtcNow.AddHours(1) // Matches Cognito's 1-hour access token validity
        });

        return Ok(new { userId = user.UserId, username = user.Username });
    }

    // POST /api/auth/logout
    [HttpPost("logout")]
    public IActionResult Logout()
    {
        Response.Cookies.Delete("auth_token");
        return Ok(new { message = "Logged out." });
    }
}
