# SOURA — Mauritania, seen by its own people

Photographers publish their work, every photo is reviewed before it goes
public, and visitors contact photographers directly to arrange use.

> Full documentation (setup, deployment, first admin) is written in the final
> build phase. Design system: see [`DESIGN.md`](./DESIGN.md).

## Quick start (development)

```bash
npm install
npm run dev        # applies migrations, starts http://localhost:3000
```

Emails are written to `.data/mail/` in development (no provider needed).
