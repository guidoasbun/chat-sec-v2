namespace ChatSec.API.Models.DTOs;

public class RegisterRequest
{
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PublicKey { get; set; } = string.Empty;       // RSA-OAEP encryption key PEM
    public string SigningPublicKey { get; set; } = string.Empty; // RSA-PSS signing key PEM
}
