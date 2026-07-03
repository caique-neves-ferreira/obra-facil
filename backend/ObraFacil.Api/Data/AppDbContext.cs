using Microsoft.EntityFrameworkCore;
using ObraFacil.Api.Models;

namespace ObraFacil.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Usuario> Usuarios => Set<Usuario>();
    public DbSet<Projeto> Projetos => Set<Projeto>();
    public DbSet<Etapa> Etapas => Set<Etapa>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Usuario>(e =>
        {
            e.ToTable("usuarios");
            e.HasKey(u => u.Id);
            e.Property(u => u.Nome).HasMaxLength(120).IsRequired();
            e.Property(u => u.Email).HasMaxLength(180).IsRequired();
            e.HasIndex(u => u.Email).IsUnique();
            e.Property(u => u.SenhaHash).IsRequired();
            e.Property(u => u.Plano).HasConversion<int>();
        });

        modelBuilder.Entity<Projeto>(e =>
        {
            e.ToTable("projetos");
            e.HasKey(p => p.Id);
            e.Property(p => p.Nome).HasMaxLength(160).IsRequired();
            e.Property(p => p.Descricao).HasMaxLength(2000);
            e.Property(p => p.Endereco).HasMaxLength(300);
            e.Property(p => p.Orcamento).HasPrecision(14, 2);
            e.Property(p => p.Status).HasConversion<int>();
            e.HasIndex(p => p.UsuarioId);

            e.HasOne(p => p.Usuario)
                .WithMany(u => u.Projetos)
                .HasForeignKey(p => p.UsuarioId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Etapa>(e =>
        {
            e.ToTable("etapas");
            e.HasKey(x => x.Id);
            e.Property(x => x.Nome).HasMaxLength(160).IsRequired();
            e.HasIndex(x => new { x.ProjetoId, x.Ordem });

            e.HasOne(x => x.Projeto)
                .WithMany(p => p.Etapas)
                .HasForeignKey(x => x.ProjetoId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
