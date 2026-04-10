using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.Model;
using ChatSec.API.Models;

namespace ChatSec.API.Services;

public class DynamoDbService
{
    private readonly IAmazonDynamoDB _client;
    private readonly IConfiguration _config;
    private readonly ILogger<DynamoDbService> _logger;

    // Table name constants — single source of truth
    private const string UsersTable    = "users";
    private const string ChatsTable    = "chats";
    private const string MessagesTable = "messages";

    public DynamoDbService(IAmazonDynamoDB client, IConfiguration config, ILogger<DynamoDbService> logger)
    {
        _client = client;
        _config = config;
        _logger = logger;
    }

    // ── Users ─────────────────────────────────────────────────────────────────

    public async Task PutUserAsync(User user)
    {
        var request = new PutItemRequest
        {
            TableName = UsersTable,
            Item = new Dictionary<string, AttributeValue>
            {
                ["userId"]    = new AttributeValue { S = user.UserId },
                ["username"]  = new AttributeValue { S = user.Username },
                ["publicKey"] = new AttributeValue { S = user.PublicKey },
                ["createdAt"] = new AttributeValue { S = user.CreatedAt }
            }
        };

        await _client.PutItemAsync(request);
        _logger.LogInformation("Created user {Username}", user.Username);
    }

    public async Task<User?> GetUserByIdAsync(string userId)
    {
        var request = new GetItemRequest
        {
            TableName = UsersTable,
            Key = new Dictionary<string, AttributeValue>
            {
                ["userId"] = new AttributeValue { S = userId }
            }
        };

        var response = await _client.GetItemAsync(request);

        if (!response.IsItemSet) return null;

        return MapToUser(response.Item);
    }

    public async Task<User?> GetUserByUsernameAsync(string username)
    {
        // Uses the GSI (Global Secondary Index) on the username attribute
        var request = new QueryRequest
        {
            TableName = UsersTable,
            IndexName = "username-index",
            KeyConditionExpression = "username = :username",
            ExpressionAttributeValues = new Dictionary<string, AttributeValue>
            {
                [":username"] = new AttributeValue { S = username }
            },
            Limit = 1
        };

        var response = await _client.QueryAsync(request);

        return response.Items.Count == 0 ? null : MapToUser(response.Items[0]);
    }

    // ── Chats ─────────────────────────────────────────────────────────────────

    public async Task PutChatAsync(Chat chat)
    {
        var request = new PutItemRequest
        {
            TableName = ChatsTable,
            Item = new Dictionary<string, AttributeValue>
            {
                ["chatId"]       = new AttributeValue { S = chat.ChatId },
                ["participants"] = new AttributeValue { SS = chat.Participants },
                ["encryptedKeyBundles"] = new AttributeValue
                {
                    M = chat.EncryptedKeyBundles.ToDictionary(
                        kvp => kvp.Key,
                        kvp => new AttributeValue { S = kvp.Value })
                },
                ["createdAt"] = new AttributeValue { S = chat.CreatedAt },
                ["isActive"]  = new AttributeValue { BOOL = chat.IsActive }
            }
        };

        await _client.PutItemAsync(request);
        _logger.LogInformation("Created chat {ChatId}", chat.ChatId);
    }

    public async Task<Chat?> GetChatAsync(string chatId)
    {
        var request = new GetItemRequest
        {
            TableName = ChatsTable,
            Key = new Dictionary<string, AttributeValue>
            {
                ["chatId"] = new AttributeValue { S = chatId }
            }
        };

        var response = await _client.GetItemAsync(request);

        if (!response.IsItemSet) return null;

        return MapToChat(response.Item);
    }

    // ── Messages ──────────────────────────────────────────────────────────────

    public async Task PutMessageAsync(Message message)
    {
        var request = new PutItemRequest
        {
            TableName = MessagesTable,
            Item = new Dictionary<string, AttributeValue>
            {
                ["chatId"]           = new AttributeValue { S = message.ChatId },
                ["timestamp"]        = new AttributeValue { S = message.Timestamp },
                ["messageId"]        = new AttributeValue { S = message.MessageId },
                ["senderId"]         = new AttributeValue { S = message.SenderId },
                ["encryptedContent"] = new AttributeValue { S = message.EncryptedContent },
                ["iv"]               = new AttributeValue { S = message.Iv },
                ["signature"]        = new AttributeValue { S = message.Signature },
                ["signatureType"]    = new AttributeValue { S = message.SignatureType }
            }
        };

        await _client.PutItemAsync(request);
    }

    public async Task<List<Message>> GetMessagesAsync(string chatId, int limit = 50)
    {
        // Queries by partition key (chatId), returns newest messages first via ScanIndexForward=false
        var request = new QueryRequest
        {
            TableName = MessagesTable,
            KeyConditionExpression = "chatId = :chatId",
            ExpressionAttributeValues = new Dictionary<string, AttributeValue>
            {
                [":chatId"] = new AttributeValue { S = chatId }
            },
            ScanIndexForward = false, // Descending order — newest first
            Limit = limit
        };

        var response = await _client.QueryAsync(request);

        return response.Items.Select(MapToMessage).ToList();
    }

    // ── Private mappers ───────────────────────────────────────────────────────
    // These convert raw DynamoDB attribute dictionaries into our model classes

    private static User MapToUser(Dictionary<string, AttributeValue> item) => new()
    {
        UserId    = item.TryGetValue("userId",    out var uid) ? uid.S : string.Empty,
        Username  = item.TryGetValue("username",  out var un)  ? un.S  : string.Empty,
        PublicKey = item.TryGetValue("publicKey", out var pk)  ? pk.S  : string.Empty,
        CreatedAt = item.TryGetValue("createdAt", out var ca)  ? ca.S  : string.Empty
    };

    private static Chat MapToChat(Dictionary<string, AttributeValue> item) => new()
    {
        ChatId       = item.TryGetValue("chatId",    out var cid) ? cid.S : string.Empty,
        Participants = item.TryGetValue("participants", out var p) ? p.SS  : [],
        EncryptedKeyBundles = item.TryGetValue("encryptedKeyBundles", out var ekb)
            ? ekb.M.ToDictionary(kvp => kvp.Key, kvp => kvp.Value.S)
            : [],
        CreatedAt = item.TryGetValue("createdAt", out var ca) ? ca.S       : string.Empty,
        IsActive  = item.TryGetValue("isActive",  out var ia) && ia.BOOL
    };

    private static Message MapToMessage(Dictionary<string, AttributeValue> item) => new()
    {
        ChatId           = item.TryGetValue("chatId",           out var cid) ? cid.S : string.Empty,
        Timestamp        = item.TryGetValue("timestamp",        out var ts)  ? ts.S  : string.Empty,
        MessageId        = item.TryGetValue("messageId",        out var mid) ? mid.S : string.Empty,
        SenderId         = item.TryGetValue("senderId",         out var sid) ? sid.S : string.Empty,
        EncryptedContent = item.TryGetValue("encryptedContent", out var ec)  ? ec.S  : string.Empty,
        Iv               = item.TryGetValue("iv",               out var iv)  ? iv.S  : string.Empty,
        Signature        = item.TryGetValue("signature",        out var sig) ? sig.S : string.Empty,
        SignatureType    = item.TryGetValue("signatureType",    out var st)  ? st.S  : string.Empty
    };
}
