namespace ChatSec.API.Models;

public class Message
{
    public string ChatId { get; set; } = string.Empty;           // Partition key — which chat this belongs to
    public string Timestamp { get; set; } = string.Empty;        // Sort key — ISO 8601, enables chronological queries
    public string MessageId { get; set; } = string.Empty;        // UUID — unique identifier for this message
    public string SenderId { get; set; } = string.Empty;         // Cognito sub of the sender
    public string EncryptedContent { get; set; } = string.Empty; // Base64(AES-256-GCM ciphertext) — never plaintext
    public string Iv { get; set; } = string.Empty;               // Base64(12-byte GCM IV) — unique per message
    public string Signature { get; set; } = string.Empty;        // Base64(RSA-PSS or DSA signature)
    public string SignatureType { get; set; } = string.Empty;    // "RSA-PSS" or "DSA"

}