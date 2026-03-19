using AvoMapper.Models;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "AvoMapper Users API", Version = "v1" });
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("AvoMapperPolicy", policy =>
    {
        policy.WithOrigins("http://localhost:3000")
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

// Simple in-memory store
builder.Services.AddSingleton<IUserStore, InMemoryUserStore>();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("AvoMapperPolicy");
app.UseAuthorization();
app.MapControllers();

app.Run("http://localhost:5000");
