using Microsoft.AspNetCore.Mvc;
using ChatSec.API.Services;
using ChatSec.API.Models;
using ChatSec.API.Models.DTOs;

namespace ChatSec.API.Controllers;

[ApiController]
[Route("api/chat")]
public class ChatController : ControllerBase
{
    private readonly DynamoDbService _dynamo;

    public ChatController(DynamoDbService dynamo)
    {
        _dynamo = dynamo;
    }

    // POST /api/chat/initiate
    // Creates a new chat between two users and stores it in DynamoDB.
    // In Phase 3, encryptedKeyBundles will carry each participant's RSA-wrapped AES key.
    [HttpPost("initiate")]
    public async Task<IActionResult> InitiateChat([FromBody] InitiateChatRequest request)
    {
        var chat = new Chat
        {
            ChatId       = Guid.NewGuid().ToString(),
            Participants = request.Participants,
            EncryptedKeyBundles = new Dictionary<string, string>(), // filled in Phase 3
            CreatedAt    = DateTime.UtcNow.ToString("o"),
            IsActive     = true
        };

        await _dynamo.PutChatAsync(chat);

        return Ok(new { chat.ChatId });
    }

    // GET /api/chat/{chatId}/messages
    // Returns message history for a chat, newest first.
    [HttpGet("{chatId}/messages")]
    public async Task<IActionResult> GetMessages(string chatId)
    {
        var messages = await _dynamo.GetMessagesAsync(chatId);
        return Ok(messages);
    }
}
