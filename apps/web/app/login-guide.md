# Login Test Guide

## Open the Login Page

1. Start the auth server:

```powershell
# Load infra/docker/.env into the current shell
$envFile = Get-Content .\infra\docker\.env
foreach ($line in $envFile) {
	$trim = $line.Trim()
	if (-not $trim -or $trim.StartsWith("#")) { continue }
	$trim = $trim -replace "\s+#.*$", ""
	$parts = $trim -split "=", 2
	if ($parts.Length -eq 2) { Set-Item -Path ("env:" + $parts[0]) -Value $parts[1] }
}
```

Then start:

```powershell
npm run start:auth -w @linksee/api
```

2. Open in browser:

```
http://localhost:3001/app/login.html
```

## Test Accounts

- Academic (教务): 2022000001 / ChangeMe123!
- Teacher (老师): 2023000001 / ChangeMe123!
- Assistant (助教): 2023019001 / ChangeMe123!
- Student (学生): 2023010001 / ChangeMe123!

The dashboard entry page reads `auth_role` or maps the user ID to auto-redirect into each role view.

## Notes

- If the page cannot be opened, confirm the auth server is listening on http://localhost:3001.
- If the account does not work, re-run the seed script to create all four roles:

```powershell
npm run seed:auth-user -w @linksee/api
```
