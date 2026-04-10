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
    private readonly ILogger<AuthController> _logger;

    public AuthController(DynamoDbService db, ILogger<AuthController> logger)
    {
        _db = db;
        _logger = logger;
    }

    // POST /api/auth/register
    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        // Validate required fields
        if (string.IsNullOrWhiteSpace(request.Username) ||
            string.IsNullOrWhiteSpace(request.Password) ||
            string.IsNullOrWhiteSpace(request.PublicKey))
        {
            return BadRequest(new { error = "Username, password, and public key are required." });
        }

        // Check username is not already taken
        var existing = await _db.GetUserByUsernameAsync(request.Username);
        if (existing != null)
        {
            return Conflict(new { error = "Username already exists." });
        }

        // TODO (Phase 4): Replace mock userId with real Cognito sub
        // var cognitoUserId = await _cognito.SignUpAsync(request.Username, request.Password, request.Email);
        var userId = Guid.NewGuid().ToString();

        var user = new User
        {
            UserId    = userId,
            Username  = request.Username,
            PublicKey = request.PublicKey,
            CreatedAt = DateTime.UtcNow.ToString("o") // ISO 8601 format
        };

        await _db.PutUserAsync(user);

        _logger.LogInformation("Registered user {Username} with id {UserId}", user.Username, user.UserId);

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

        var user = await _db.GetUserByUsernameAsync(request.Username);
        if (user == null)
        {
            // Return the same message whether user doesn't exist or password is wrong
            // This prevents username enumeration attacks
            return Unauthorized(new { error = "Invalid username or password." });
        }

        // TODO (Phase 4): Replace mock token with real Cognito JWT
        // var tokens = await _cognito.InitiateAuthAsync(request.Username, request.Password);
        var mockToken = Convert.ToBase64String(
            System.Text.Encoding.UTF8.GetBytes($"{user.UserId}:{user.Username}:{DateTime.UtcNow:o}"));

        // POST /api/auth/login — sets HttpOnly cookie, returns user info only (no token)
        Response.Cookies.Append("auth_token", mockToken, new CookieOptions
        {
            HttpOnly = true,
            Secure   = true,
            SameSite = SameSiteMode.Strict,
            Expires  = DateTimeOffset.UtcNow.AddHours(8)
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
