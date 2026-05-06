param([string]$Base = "http://localhost:3001/api/v1")
$p = 0; $f = 0

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
$ApiDir = Join-Path $RepoRoot "apps\api"

function Req {
  param($Method, $Path, $Body = $null, $Token = $null)
  $h = @{}
  if ($Token) { $h["Authorization"] = "Bearer $Token" }
  try {
    $prm = @{ Method = $Method; Uri = "$Base$Path"; ErrorAction = "Stop"; Headers = $h; UseBasicParsing = $true }
    if ($Body) { $prm.Body = ($Body | ConvertTo-Json -Compress -Depth 5); $prm.ContentType = "application/json" }
    $r = Invoke-WebRequest @prm
    return [PSCustomObject]@{ S = [int]$r.StatusCode; D = ($r.Content | ConvertFrom-Json) }
  } catch {
    $status = [int]$_.Exception.Response.StatusCode
    $raw = ""; if ($_.ErrorDetails) { $raw = $_.ErrorDetails.Message }
    $d = $null; if ($raw -ne "") { try { $d = $raw | ConvertFrom-Json } catch {} }
    return [PSCustomObject]@{ S = $status; D = $d }
  }
}

function Chk {
  param($Name, $R, $Exp, [scriptblock]$Check = $null)
  $ok = ($R.S -eq $Exp)
  if ($ok -and $Check) { $ok = (& $Check $R.D) }
  if ($ok) { $script:p++; Write-Host "[PASS] $Name" }
  else { $script:f++; Write-Host "[FAIL] $Name  (got $($R.S) want $Exp) $($R.D | ConvertTo-Json -Compress)" }
}

Write-Host ""; Write-Host "--- Reset seeded accounts ---"
& npx --prefix "$ApiDir" tsx "$ApiDir\src\auth\seed-test-user.ts" 2>&1 | ForEach-Object { Write-Host "  $_" }

Write-Host ""; Write-Host "=== 1. Login ==="
Chk "invalid userId -> 400" (Req POST "/auth/login" @{userId="notdigits";password="x"}) 400
Chk "wrong password -> 401" (Req POST "/auth/login" @{userId="2023010001";password="wrongpass"}) 401
$r = Req POST "/auth/login" @{userId="2023010001";password="ChangeMe123!"}
Chk "correct login -> 200 with AT+RT" $r 200 { param($d) $d.ok -and $d.data.accessToken -and $d.data.refreshToken }
$AT = $r.D.data.accessToken; $RT = $r.D.data.refreshToken
Write-Host "  forceChangePassword=$($r.D.data.forceChangePassword)"

Write-Host ""; Write-Host "=== 2. forceChange guard ==="
Chk "GET /me blocked -> 403" (Req GET "/users/me" -Token $AT) 403
Chk "PATCH /me blocked -> 403" (Req PATCH "/users/me" @{bio="x"} $AT) 403

Write-Host ""; Write-Host "=== 3. Change password ==="
# Server returns 422 for semantic validation (weak password), 403 for wrong current password
Chk "weak new password -> 422" (Req POST "/auth/change-password" @{currentPassword="ChangeMe123!";newPassword="weak"} $AT) 422
Chk "wrong current password -> 403" (Req POST "/auth/change-password" @{currentPassword="wrongpass";newPassword="Test@2026!"} $AT) 403
Chk "change password -> 200" (Req POST "/auth/change-password" @{currentPassword="ChangeMe123!";newPassword="Test@2026!"} $AT) 200
$r = Req POST "/auth/login" @{userId="2023010001";password="Test@2026!"}
Chk "login with new password -> 200" $r 200
$AT = $r.D.data.accessToken; $RT = $r.D.data.refreshToken
Write-Host "  forceChangePassword=$($r.D.data.forceChangePassword)"

Write-Host ""; Write-Host "=== 4. GET /users/me ==="
Chk "no token -> 401" (Req GET "/users/me") 401
$r = Req GET "/users/me" -Token $AT
Chk "valid token -> 200 with profile+avatarUrl" $r 200 { param($d) $d.ok -and $d.data.id -and $d.data.profile.avatarUrl }
Write-Host "  user=$($r.D.data | ConvertTo-Json -Compress)"

Write-Host ""; Write-Host "=== 5. PATCH /users/me ==="
Chk "update bio/location -> 200" (Req PATCH "/users/me" @{bio="smoke test bio";location="Beijing"} $AT) 200
# Server returns 403 for fields user cannot modify (permission level, not just bad input)
Chk "forbidden stuNo -> 403" (Req PATCH "/users/me" @{stuNo="S999"} $AT) 403
Chk "forbidden teacherNo -> 403" (Req PATCH "/users/me" @{teacherNo="T001"} $AT) 403
$r = Req GET "/users/me" -Token $AT
Chk "bio persisted correctly" $r 200 { param($d) $d.data.profile.bio -eq "smoke test bio" }

Write-Host ""; Write-Host "=== 6. Token refresh ==="
Chk "empty body -> 400" (Req POST "/auth/refresh" @{}) 400
$r = Req POST "/auth/refresh" @{refreshToken=$RT}
Chk "refresh -> 200 with new AT" $r 200 { param($d) $d.data.accessToken }
$AT = $r.D.data.accessToken
Write-Host "  new AT (first 20 chars)=$($AT.Substring(0,[Math]::Min(20,$AT.Length)))..."

Write-Host ""; Write-Host "=== 7. Role-based access (student token) ==="
Chk "student: POST /users -> 403" (Req POST "/users" @{role="student";realName="Test"} $AT) 403
Chk "student: POST /users/batch/students -> 403" (Req POST "/users/batch/students" @{items=@()} $AT) 403
Chk "student: POST /users/batch/teachers -> 403" (Req POST "/users/batch/teachers" @{items=@()} $AT) 403
Chk "student: POST /users/assistants -> 403" (Req POST "/users/assistants" @{realName="Asst"} $AT) 403
Chk "student: PATCH /users/999 -> 403" (Req PATCH "/users/2023010001" @{realName="Hacked"} $AT) 403

Write-Host ""; Write-Host "=== 8. Academic integration ==="
$ra = Req POST "/auth/login" @{userId="1000000001";password="Academic@2026"}
Chk "academic login -> 200" $ra 200 { param($d) $d.ok -and $d.data.accessToken }
$AcademicAT = $ra.D.data.accessToken

$idStudent = (Get-Random -Minimum 3100000000 -Maximum 3199999999).ToString()
$idTeacher = (([int64]$idStudent) + 1).ToString()
$idBatchStudentOk = (([int64]$idStudent) + 2).ToString()
$idBatchTeacherOk = (([int64]$idStudent) + 3).ToString()

$rCreateS = Req POST "/users" @{id=$idStudent;role="student";realName="Smoke Student";stuNo="S$idStudent";grade=2024;cohort=1;major="Software Engineering";adminClass="SE2401"} $AcademicAT
Chk "academic create student -> 201" $rCreateS 201

$rCreateT = Req POST "/users" @{id=$idTeacher;role="teacher";realName="Smoke Teacher";teacherNo="T$idTeacher";title="Lecturer";college="Software School";researchDirection="Testing"} $AcademicAT
Chk "academic create teacher -> 201" $rCreateT 201

$rBatchS = Req POST "/users/batch/students" @{students=@(
  @{id=$idBatchStudentOk;realName="Batch Student";stuNo="S$idBatchStudentOk";grade=2024;cohort=1;major="Software Engineering";adminClass="SE2401"},
  @{id="bad";realName="Invalid";stuNo="X";grade="x";cohort=1;major="Software Engineering";adminClass="SE2401"}
)} $AcademicAT
Chk "academic batch students -> 200" $rBatchS 200 { param($d) $d.ok -and $d.data.createdCount -eq 1 -and $d.data.failedCount -eq 1 }

$rBatchT = Req POST "/users/batch/teachers" @{teachers=@(
  @{id=$idBatchTeacherOk;realName="Batch Teacher";teacherNo="T$idBatchTeacherOk";title="Professor";college="Software School"},
  @{id="bad";realName="Invalid";teacherNo="";title="";college=""}
)} $AcademicAT
Chk "academic batch teachers -> 200" $rBatchT 200 { param($d) $d.ok -and $d.data.createdCount -eq 1 -and $d.data.failedCount -eq 1 }

$rPatch = Req PATCH "/users/$idStudent" @{isActive=$false;realName="Smoke Student Updated"} $AcademicAT
Chk "academic patch user -> 200" $rPatch 200 { param($d) $d.ok -and $d.data.id -eq $idStudent -and $d.data.role -eq "student" }

$rPatchInvalid = Req PATCH "/users/$idStudent" @{isActive="false"} $AcademicAT
Chk "academic patch isActive string rejected -> 400" $rPatchInvalid 400

Write-Host ""; Write-Host "=== 9. Logout ==="
Chk "logout -> 200" (Req POST "/auth/logout" @{refreshToken=$RT}) 200
Chk "refresh after logout -> 401" (Req POST "/auth/refresh" @{refreshToken=$RT}) 401

Write-Host ""; Write-Host "=== 10. Teacher + Assistant integration ==="
$TeacherLogin = Req POST "/auth/login" @{userId="2000000001";password="Teacher@2026"} $null
Chk "teacher login -> 200" $TeacherLogin 200 { param($d) $d.data.accessToken -ne $null }
$TeacherAT = $TeacherLogin.D.data.accessToken

$AssistantId = (Get-Random -Minimum 3500000000 -Maximum 3599999999).ToString()
$rCreateAssistant = Req POST "/users/assistants" @{id=$AssistantId;realName="Smoke Assistant"} $TeacherAT
Chk "teacher create assistant -> 201" $rCreateAssistant 201 { param($d) $d.ok -and $d.data.id -eq $AssistantId }

$rResetAssistant = Req POST "/auth/admin/reset-password" @{targetUserId=$AssistantId} $TeacherAT
Chk "teacher reset own assistant -> 200" $rResetAssistant 200 { param($d) $d.ok -and $d.data.temporaryPassword -ne $null }

$rResetStranger = Req POST "/auth/admin/reset-password" @{targetUserId="2023010001"} $TeacherAT
Chk "teacher reset student (not binding) -> 403" $rResetStranger 403

$rStudentCreateAssistant = Req POST "/users/assistants" @{id="3599999998";realName="Forbidden"} $AT
Chk "student create assistant -> 403" $rStudentCreateAssistant 403

Write-Host ""; Write-Host "==============================="
Write-Host "TOTAL: $p PASS / $f FAIL"
Write-Host "==============================="
if ($f -gt 0) { exit 1 }
