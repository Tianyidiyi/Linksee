# scripts

此目录存放自动化脚本，减少重复手工操作。

## 推荐脚本类型

- 初始化脚本：本地环境准备、依赖安装
- 数据脚本：数据库迁移、种子数据
- 质量脚本：lint、test、build 聚合命令
- 发布脚本：打包、版本号更新、发布辅助

## 规范

- 脚本需可重复执行
- 脚本失败要有清晰错误输出
- 脚本参数与使用方式写入文档

## 当前可用脚本

- [db-backup.ps1](db-backup.ps1)：备份 Docker 中 MySQL 数据库
- [db-restore.ps1](db-restore.ps1)：从 SQL 备份文件恢复数据库

## 使用前准备

1. 已安装 Docker Desktop，并能在终端执行 docker 命令。
2. 已创建环境变量文件：[infra/docker/.env](../infra/docker/.env)。
3. 已启动至少 mysql 服务（脚本也会尝试自动拉起）。

## 备份示例

```powershell
pwsh -File scripts/db-backup.ps1
```

常用参数示例：

```powershell
pwsh -File scripts/db-backup.ps1 -Database collab -OutputDir backups
```

## 恢复示例

```powershell
pwsh -File scripts/db-restore.ps1 -BackupFile backups/mysql_collab_20260409_120000.sql
```

常用参数示例：

```powershell
pwsh -File scripts/db-restore.ps1 -BackupFile backups/mysql_collab_latest.sql -Database collab
```

## 注意事项

- 恢复脚本会重建目标数据库，请先确认备份文件与目标库名称。
- 不要在业务高峰期执行恢复操作。
- 迁移前建议先执行一次备份，再做结构变更。
