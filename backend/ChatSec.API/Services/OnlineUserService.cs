using StackExchange.Redis;

namespace ChatSec.API.Services;

public class OnlineUserService
{
    private readonly IDatabase _db;
    private const string OnlineSetKey = "online_users";

    public OnlineUserService(IConnectionMultiplexer redis)
    {
        _db = redis.GetDatabase();
    }

    public Task MarkOnlineAsync(string userId) =>
        _db.SetAddAsync(OnlineSetKey, userId);

    public Task MarkOfflineAsync(string userId) =>
        _db.SetRemoveAsync(OnlineSetKey, userId);

    public async Task<bool> IsOnlineAsync(string userId) =>
        await _db.SetContainsAsync(OnlineSetKey, userId);

    public async Task<IEnumerable<string>> GetOnlineUsersAsync()
    {
        var members = await _db.SetMembersAsync(OnlineSetKey);
        return members.Select(m => m.ToString());
    }
}
