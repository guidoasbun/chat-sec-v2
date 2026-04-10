namespace ChatSec.API.Models.DTOs;

public class InitiateChatRequest
{
    // The two (or more) userIds who will be in this chat
    public List<string> Participants { get; set; } = [];

    // Each entry: the recipient's userId and their copy of the AES session key
    // encrypted with their RSA public key — so only they can decrypt it.
    // Left empty in Phase 2; filled in Phase 3 when E2E encryption is added.
    public Dictionary<string, string> EncryptedKeyBundles { get; set; } = [];
}
