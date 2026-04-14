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
            EncryptedKeyBundles = request.EncryptedKeyBundles,
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

    // GET /api/chat/{chatId}
    // Returns chat metadata including encryptedKeyBundles so participants
    // can decrypt their copy of the AES session key.
    [HttpGet("{chatId}")]
    public async Task<IActionResult> GetChat(string chatId)
    {
        var chat = await _dynamo.GetChatAsync(chatId);
        if (chat == null)
            return NotFound(new { error = "Chat not found." });

        return Ok(chat);
    }

}
