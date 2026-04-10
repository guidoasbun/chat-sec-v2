using Microsoft.AspNetCore.Mvc;
using ChatSec.API.Services;

namespace ChatSec.API.Controllers;

[ApiController]
[Route("api/users")]
public class UserController : ControllerBase
{
    private readonly DynamoDbService _db;
    private readonly ILogger<UserController> _logger;

    public UserController(DynamoDbService db, ILogger<UserController> logger)
    {
        _db = db;
        _logger = logger;
    }

    // GET /api/users/{username}/public-key
    // Used by the frontend when initiating a chat — encrypts the AES session
    // key with each participant's public key so only they can decrypt it
    [HttpGet("{username}/public-key")]
    public async Task<IActionResult> GetPublicKey(string username)
    {
        if (string.IsNullOrWhiteSpace(username))
            return BadRequest(new { error = "Username is required." });

        var user = await _db.GetUserByUsernameAsync(username);
        if (user == null)
            return NotFound(new { error = "User not found." });

        return Ok(new { username = user.Username, publicKey = user.PublicKey });
    }

    // GET /api/users/online
    // Returns list of currently connected users.
    // Phase 2: this will query Redis for live presence data via OnlineUserService.
    [HttpGet("online")]
    public IActionResult GetOnlineUsers()
    {
        // TODO (Phase 2): return await _onlineUserService.GetOnlineUsersAsync();
        return Ok(new { users = Array.Empty<string>() });
    }
}
