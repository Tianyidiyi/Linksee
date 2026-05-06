# Login Test Guide

## Open the Login Page

1. Start the auth server:

```powershell
npm run start:auth -w @linksee/api
```

2. Open in browser:

```
http://localhost:3001/app/login.html
```

## Test Account

- User ID: 2023010001
- Password: ChangeMe123!

## Notes

- If the page cannot be opened, confirm the auth server is listening on http://localhost:3001.
- If the account does not work, re-run the seed script:

```powershell
npm run seed:auth-user -w @linksee/api
```
