namespace ChatSec.API.Models;

public class Chat
{
    public string ChatId { get; set; } = string.Empty;                          // UUID — primary key
    public List<string> Participants { get; set; } = [];                        // List of Cognito user IDs
    public Dictionary<string, string> EncryptedKeyBundles { get; set; } = [];  // userId → Base64(RSA-OAEP(aesSessionKey))
    public string CreatedAt { get; set; } = string.Empty;                       // ISO 8601 timestamp
    public bool IsActive { get; set; } = true;                                  // false = soft-deleted
}
