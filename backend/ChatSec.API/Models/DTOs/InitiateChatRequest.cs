namespace ChatSec.API.Models.DTOs;

public class InitiateChatRequest
{
    // Each entry: the recipient's userId and their copy of the AES session key
    // encrypted with their RSA public key — so only they can decrypt it
    public Dictionary<string, string> EncryptedKeyBundles { get; set; } = [];
}
