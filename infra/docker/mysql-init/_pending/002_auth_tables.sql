-- ============================================================
-- Auth 基线表结构（对应 docs/api/auth/auth-design-v1.md §三）
-- 执行顺序：在 001_create_extensions.sql 之后自动执行
-- ============================================================

-- 1. 核心身份表
CREATE TABLE IF NOT EXISTS users (
  id                   CHAR(36)     NOT NULL,
  username             VARCHAR(64)  NOT NULL,
  password_hash        VARCHAR(128) NOT NULL,                      -- Argon2id 散列，含内嵌 salt
  role                 ENUM('academic','teacher','ta','student') NOT NULL,
  is_active            TINYINT(1)   NOT NULL DEFAULT 1,
  force_change_password TINYINT(1)  NOT NULL DEFAULT 0,            -- 首次登录必须改密
  created_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. 学生扩展信息（学号与真实姓名）
CREATE TABLE IF NOT EXISTS student_profiles (
  user_id        CHAR(36)    NOT NULL,
  student_number VARCHAR(20) NOT NULL,
  real_name      VARCHAR(40) NOT NULL,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_student_number (student_number),
  CONSTRAINT fk_sp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. 助教绑定关系（助教权限范围 = 本表中 course_id 列举的课程）
--    courses 表由业务模块创建，此处预留外键待业务表就绪后通过 migration 补充
CREATE TABLE IF NOT EXISTS ta_bindings (
  ta_user_id      CHAR(36)  NOT NULL,
  teacher_user_id CHAR(36)  NOT NULL,
  course_id       CHAR(36)  NOT NULL,
  created_at      DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (ta_user_id, course_id),
  CONSTRAINT fk_tab_ta      FOREIGN KEY (ta_user_id)      REFERENCES users(id),
  CONSTRAINT fk_tab_teacher FOREIGN KEY (teacher_user_id) REFERENCES users(id)
  -- fk_tab_course 待 courses 表创建后通过 migration 追加
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Refresh Token 存储（只存 SHA-256 散列，原始值不落库）
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         CHAR(36)    NOT NULL,
  user_id    CHAR(36)    NOT NULL,
  token_hash VARCHAR(64) NOT NULL,                                 -- SHA-256(原始token)，hex 字符串
  expires_at DATETIME    NOT NULL,
  revoked    TINYINT(1)  NOT NULL DEFAULT 0,
  created_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_token_hash (token_hash),
  KEY idx_user_revoked (user_id, revoked),
  CONSTRAINT fk_rt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. 审计日志（只记行为，不存密码/token/隐私明文）
CREATE TABLE IF NOT EXISTS audit_logs (
  id          CHAR(36)    NOT NULL,
  actor_id    CHAR(36)    NOT NULL,
  actor_role  VARCHAR(16) NOT NULL,
  action      VARCHAR(64) NOT NULL,    -- login / change_password / admin_reset_password / publish_grade ...
  target_type VARCHAR(32) DEFAULT NULL,
  target_id   CHAR(36)    DEFAULT NULL,
  ip          VARCHAR(45) DEFAULT NULL,
  created_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_actor     (actor_id),
  KEY idx_action    (action),
  KEY idx_created   (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
