using Microsoft.AspNetCore.SignalR;
using ChatSec.API.Services;
using ChatSec.API.Models;

namespace ChatSec.API.Hubs;

public class ChatHub : Hub
{
    private readonly OnlineUserService _onlineUsers;
    private readonly DynamoDbService _dynamo;

    public ChatHub(OnlineUserService onlineUsers, DynamoDbService dynamo)
    {
        _onlineUsers = onlineUsers;
        _dynamo = dynamo;
    }

    // Called automatically when a browser connects to /hubs/chat
    public override async Task OnConnectedAsync()
    {
        // In dev, userId comes from query string: ?userId=abc
        // In prod (Phase 4), this will be Context.UserIdentifier from the JWT
        var userId = Context.GetHttpContext()?.Request.Query["userId"].ToString();
        if (string.IsNullOrEmpty(userId))
        {
            Context.Abort();
            return;
        }

        // Store userId on this connection so we can access it in OnDisconnected
        Context.Items["userId"] = userId;

        await _onlineUsers.MarkOnlineAsync(userId);

        // Tell every connected client the updated online list
        var onlineUsers = await _onlineUsers.GetOnlineUsersAsync();
        await Clients.All.SendAsync("OnlineUsersUpdated", onlineUsers);

        await base.OnConnectedAsync();
    }

    // Called automatically when the browser tab closes or the connection drops
    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userId = Context.Items["userId"]?.ToString();
        if (!string.IsNullOrEmpty(userId))
        {
            await _onlineUsers.MarkOfflineAsync(userId);

            var onlineUsers = await _onlineUsers.GetOnlineUsersAsync();
            await Clients.All.SendAsync("OnlineUsersUpdated", onlineUsers);
        }

        await base.OnDisconnectedAsync(exception);
    }

    // Client calls this after connecting to subscribe to a specific chat's messages
    public async Task JoinChatAsync(string chatId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"chat:{chatId}");
    }

    // Client calls this to send a message
    public async Task SendMessageAsync(string chatId, string senderId, string encryptedContent, string iv, string signature)
    {
        var message = new Message
        {
            ChatId           = chatId,
            MessageId        = Guid.NewGuid().ToString(),
            SenderId         = senderId,
            EncryptedContent = encryptedContent,
            Iv               = iv,
            Signature        = signature,
            SignatureType    = "RSA-PSS",
            Timestamp        = DateTime.UtcNow.ToString("o")
        };

        await _dynamo.PutMessageAsync(message);

        // Broadcast only to connections in this chat's group
        await Clients.Group($"chat:{chatId}").SendAsync("ReceiveMessage", message);
    }
}
