namespace AvoMapper.Models;

public record User(
    Guid Id,
    string Username,
    string Email,
    DateTime CreatedAt
);

public record CreateUserRequest(
    string Username,
    string Email
);

public interface IUserStore
{
    IEnumerable<User> GetAll();
    User? GetById(Guid id);
    User Create(CreateUserRequest request);
    bool Delete(Guid id);
}

public class InMemoryUserStore : IUserStore
{
    private readonly List<User> _users = new()
    {
        new User(Guid.NewGuid(), "avomapper_user", "user@avomapper.com", DateTime.UtcNow)
    };

    public IEnumerable<User> GetAll() => _users.AsReadOnly();

    public User? GetById(Guid id) => _users.FirstOrDefault(u => u.Id == id);

    public User Create(CreateUserRequest request)
    {
        var user = new User(Guid.NewGuid(), request.Username, request.Email, DateTime.UtcNow);
        _users.Add(user);
        return user;
    }

    public bool Delete(Guid id)
    {
        var user = GetById(id);
        if (user is null) return false;
        _users.Remove(user);
        return true;
    }
}
