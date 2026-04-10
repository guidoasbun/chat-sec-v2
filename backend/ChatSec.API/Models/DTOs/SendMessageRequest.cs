namespace ChatSec.API.Models.DTOs;

public class SendMessageRequest
{
    public string ChatId { get; set; } = string.Empty;           // Which chat to send to
    public string EncryptedContent { get; set; } = string.Empty; // AES-256-GCM ciphertext — never plaintext
    public string Iv { get; set; } = string.Empty;               // GCM IV used to encrypt this message
    public string Signature { get; set; } = string.Empty;        // RSA-PSS or DSA signature
    public string SignatureType { get; set; } = string.Empty;    // "RSA-PSS" or "DSA"
}
