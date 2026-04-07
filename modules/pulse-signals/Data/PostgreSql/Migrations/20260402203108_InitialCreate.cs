using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace PulseSignals.Data.PostgreSql.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "pulse");

            migrationBuilder.CreateTable(
                name: "pulse_signals",
                schema: "pulse",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityAlwaysColumn),
                    signal_name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    value = table.Column<decimal>(type: "numeric(18,6)", nullable: false),
                    paypoint_id = table.Column<long>(type: "bigint", nullable: false),
                    parent_idx = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    org_id = table.Column<long>(type: "bigint", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pulse_signals", x => x.id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "pulse_signals",
                schema: "pulse");
        }
    }
}
