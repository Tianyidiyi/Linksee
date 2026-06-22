(function () {
    function escapeHtml(value) {
        return window.linkseePage && typeof window.linkseePage.escapeHtml === "function"
            ? window.linkseePage.escapeHtml(value)
            : String(value || "");
    }

    var STUDENT_MAJOR_CATALOG = [
        { value: "软件工程", shortCode: "软工" },
        { value: "计算机科学与技术", shortCode: "计科" },
        { value: "数据科学与大数据技术", shortCode: "数科" },
        { value: "人工智能", shortCode: "人智" },
        { value: "网络工程", shortCode: "网工" },
        { value: "信息安全", shortCode: "信安" },
    ];

    window.initAcademicDashboard = function initAcademicDashboard() {
        var list = document.getElementById("academicCourseList");
        var empty = document.getElementById("academicCourseEmpty");
        var courseMeta = document.getElementById("academicCourseMeta");
        var courseNote = document.getElementById("academicCourseNote");
        var courseSearch = document.getElementById("academicCourseSearch");
        var courseTeacherFilter = document.getElementById("academicCourseTeacherFilter");
        var courseYearFilter = document.getElementById("academicCourseYearFilter");
        var courseSemesterFilter = document.getElementById("academicCourseSemesterFilter");
        var courseStatusFilter = document.getElementById("academicCourseStatusFilter");
        var coursePagination = document.getElementById("academicCoursePagination");
        var coursePrevPageBtn = document.getElementById("academicCoursePrevPageBtn");
        var courseNextPageBtn = document.getElementById("academicCourseNextPageBtn");
        var coursePageButtons = document.getElementById("academicCoursePageButtons");
        var editCourseSelect = document.getElementById("academicEditCourseSelect");
        var editCourseHint = document.getElementById("academicEditCourseHint");
        var editCourseMeta = document.getElementById("academicEditCourseMeta");
        var editCourseNo = document.getElementById("academicEditCourseNo");
        var editCourseName = document.getElementById("academicEditCourseName");
        var editCourseDescription = document.getElementById("academicEditCourseDescription");
        var editCourseStatus = document.getElementById("academicEditCourseStatus");
        var editSubmitBtn = document.getElementById("academicEditSubmitBtn");
        var editResetBtn = document.getElementById("academicEditResetBtn");
        var editResult = document.getElementById("academicEditResult");
        var openMemberPickerBtn = document.getElementById("academicOpenMemberPickerBtn");
        var memberPicker = document.getElementById("academicMemberPicker");
        var memberPickerTitle = document.getElementById("academicMemberPickerTitle");
        var memberPickerMeta = document.getElementById("academicMemberPickerMeta");
        var memberPickerTable = document.getElementById("academicMemberPickerTable");
        var rosterImportInput = document.getElementById("academicRosterImportInput");
        var rosterImportBtn = document.getElementById("academicRosterImportBtn");
        var memberPickerApplyBtn = document.getElementById("academicMemberPickerApplyBtn");
        var memberPickerCloseBtn = document.getElementById("academicMemberPickerCloseBtn");
        var memberTabStudent = document.getElementById("academicMemberTabStudent");
        var memberTabTeacher = document.getElementById("academicMemberTabTeacher");
        var memberStudentFilters = document.getElementById("academicMemberStudentFilters");
        var memberTeacherFilters = document.getElementById("academicMemberTeacherFilters");
        var memberStudentName = document.getElementById("academicMemberStudentName");
        var memberStudentStuNo = document.getElementById("academicMemberStudentStuNo");
        var memberStudentGrade = document.getElementById("academicMemberStudentGrade");
        var memberStudentMajor = document.getElementById("academicMemberStudentMajor");
        var memberStudentAdminClass = document.getElementById("academicMemberStudentAdminClass");
        var memberStudentAddedOnly = document.getElementById("academicMemberStudentAddedOnly");
        var memberStudentSearchBtn = document.getElementById("academicMemberStudentSearchBtn");
        var memberStudentResetBtn = document.getElementById("academicMemberStudentResetBtn");
        var memberTeacherName = document.getElementById("academicMemberTeacherName");
        var memberTeacherNo = document.getElementById("academicMemberTeacherNo");
        var memberTeacherCollege = document.getElementById("academicMemberTeacherCollege");
        var memberTeacherRole = document.getElementById("academicMemberTeacherRole");
        var memberTeacherAddedOnly = document.getElementById("academicMemberTeacherAddedOnly");
        var memberTeacherSearchBtn = document.getElementById("academicMemberTeacherSearchBtn");
        var memberTeacherResetBtn = document.getElementById("academicMemberTeacherResetBtn");
        var memberSelectAll = document.getElementById("academicMemberSelectAll");
        var memberSelectionMeta = document.getElementById("academicMemberSelectionMeta");
        var memberPrevPageBtn = document.getElementById("academicMemberPrevPageBtn");
        var memberNextPageBtn = document.getElementById("academicMemberNextPageBtn");
        var memberPageButtons = document.getElementById("academicMemberPageButtons");
        var courseRelationTeachers = document.getElementById("academicCourseRelationTeachers");
        var courseRelationAssistants = document.getElementById("academicCourseRelationAssistants");
        var courseRelationMembers = document.getElementById("academicCourseRelationMembers");
        var courseTeacherCount = document.getElementById("academicCourseTeacherCount");
        var courseStudentCount = document.getElementById("academicCourseStudentCount");
        var courseStudentDetailBtn = document.getElementById("academicCourseStudentDetailBtn");
        var courseRelationResult = document.getElementById("academicCourseRelationResult");
        var studentDetail = document.getElementById("academicStudentDetail");
        var studentDetailCloseBtn = document.getElementById("academicStudentDetailCloseBtn");
        var studentDetailName = document.getElementById("academicStudentDetailName");
        var studentDetailStuNo = document.getElementById("academicStudentDetailStuNo");
        var studentDetailGrade = document.getElementById("academicStudentDetailGrade");
        var studentDetailMajor = document.getElementById("academicStudentDetailMajor");
        var studentDetailAdminClass = document.getElementById("academicStudentDetailAdminClass");
        var studentDetailSaveBtn = document.getElementById("academicStudentDetailSaveBtn");
        var studentDetailRemoveBtn = document.getElementById("academicStudentDetailRemoveBtn");
        var batchDefaultPassword = document.getElementById("academicBatchDefaultPassword");
        var batchStudents = document.getElementById("academicBatchStudents");
        var batchTeachers = document.getElementById("academicBatchTeachers");
        var batchStudentSubmitBtn = document.getElementById("academicBatchStudentSubmitBtn");
        var batchStudentClearBtn = document.getElementById("academicBatchStudentClearBtn");
        var batchTeacherSubmitBtn = document.getElementById("academicBatchTeacherSubmitBtn");
        var batchTeacherClearBtn = document.getElementById("academicBatchTeacherClearBtn");
        var batchResult = document.getElementById("academicBatchResult");
        var userSummaryMeta = document.getElementById("academicUserSummaryMeta");
        var userDirectoryMeta = document.getElementById("academicUserDirectoryMeta");
        var userTabStudent = document.getElementById("academicUserTabStudent");
        var userTabTeacher = document.getElementById("academicUserTabTeacher");
        var userTabAssistant = document.getElementById("academicUserTabAssistant");
        var userStudentFilters = document.getElementById("academicUserStudentFilters");
        var userTeacherFilters = document.getElementById("academicUserTeacherFilters");
        var userAssistantFilters = document.getElementById("academicUserAssistantFilters");
        var userStudentKeyword = document.getElementById("academicUserStudentKeyword");
        var userStudentGrade = document.getElementById("academicUserStudentGrade");
        var userStudentMajor = document.getElementById("academicUserStudentMajor");
        var userStudentAdminClass = document.getElementById("academicUserStudentAdminClass");
        var userStudentCohort = document.getElementById("academicUserStudentCohort");
        var userStudentSearchBtn = document.getElementById("academicUserStudentSearchBtn");
        var userStudentResetBtn = document.getElementById("academicUserStudentResetBtn");
        var userTeacherKeyword = document.getElementById("academicUserTeacherKeyword");
        var userTeacherCollege = document.getElementById("academicUserTeacherCollege");
        var userTeacherTitle = document.getElementById("academicUserTeacherTitle");
        var userTeacherSearchBtn = document.getElementById("academicUserTeacherSearchBtn");
        var userTeacherResetBtn = document.getElementById("academicUserTeacherResetBtn");
        var userAssistantKeyword = document.getElementById("academicUserAssistantKeyword");
        var userAssistantOwner = document.getElementById("academicUserAssistantOwner");
        var userAssistantSearchBtn = document.getElementById("academicUserAssistantSearchBtn");
        var userAssistantResetBtn = document.getElementById("academicUserAssistantResetBtn");
        var userDirectoryTable = document.getElementById("academicUserDirectoryTable");
        var userDirectoryPagination = document.getElementById("academicUserDirectoryPagination");
        var userPrevPageBtn = document.getElementById("academicUserPrevPageBtn");
        var userNextPageBtn = document.getElementById("academicUserNextPageBtn");
        var userPageButtons = document.getElementById("academicUserPageButtons");
        var userPageSize = document.getElementById("academicUserPageSize");
        var userPageJumpInput = document.getElementById("academicUserPageJumpInput");
        var userPageJumpBtn = document.getElementById("academicUserPageJumpBtn");
        var userImportInput = document.getElementById("academicUserImportInput");
        var userImportBtn = document.getElementById("academicUserImportBtn");
        var userImportMenu = document.getElementById("academicUserImportMenu");
        var userImportStudentBtn = document.getElementById("academicUserImportStudentBtn");
        var userImportTeacherBtn = document.getElementById("academicUserImportTeacherBtn");
        var userExportBtn = document.getElementById("academicUserExportBtn");
        var userExportMenu = document.getElementById("academicUserExportMenu");
        var userResetBtn = document.getElementById("academicUserResetBtn");
        var userDefaultPasswordBtn = document.getElementById("academicUserDefaultPasswordBtn");
        var userCreateBtn = document.getElementById("academicUserCreateBtn");
        var userDialog = document.getElementById("academicUserDialog");
        var userDialogTitle = document.getElementById("academicUserDialogTitle");
        var userDialogMeta = document.getElementById("academicUserDialogMeta");
        var userDialogBody = document.getElementById("academicUserDialogBody");
        var userDialogCloseBtn = document.getElementById("academicUserDialogCloseBtn");
        var userDialogDeleteBtn = document.getElementById("academicUserDialogDeleteBtn");
        var userDialogCancelBtn = document.getElementById("academicUserDialogCancelBtn");
        var userDialogSaveBtn = document.getElementById("academicUserDialogSaveBtn");
        var userBatchDialog = document.getElementById("academicUserBatchDialog");
        var userBatchDialogTitle = document.getElementById("academicUserBatchDialogTitle");
        var userBatchDialogMeta = document.getElementById("academicUserBatchDialogMeta");
        var userBatchFormatHint = document.getElementById("academicUserBatchFormatHint");
        var userImportFileName = document.getElementById("academicUserImportFileName");
        var userImportChooseBtn = document.getElementById("academicUserImportChooseBtn");
        var userBatchDialogCloseBtn = document.getElementById("academicUserBatchDialogCloseBtn");
        var userBatchDialogCancelBtn = document.getElementById("academicUserBatchDialogCancelBtn");
        var userBatchDialogSubmitBtn = document.getElementById("academicUserBatchDialogSubmitBtn");
        var userCreateDialog = document.getElementById("academicUserCreateDialog");
        var userCreateDialogTitle = document.getElementById("academicUserCreateDialogTitle");
        var userCreateDialogMeta = document.getElementById("academicUserCreateDialogMeta");
        var userCreateDialogBody = document.getElementById("academicUserCreateDialogBody");
        var userCreateDialogCloseBtn = document.getElementById("academicUserCreateDialogCloseBtn");
        var userCreateDialogCancelBtn = document.getElementById("academicUserCreateDialogCancelBtn");
        var userCreateDialogSubmitBtn = document.getElementById("academicUserCreateDialogSubmitBtn");
        var userPasswordDialog = document.getElementById("academicUserPasswordDialog");
        var userPasswordDialogCloseBtn = document.getElementById("academicUserPasswordDialogCloseBtn");
        var userPasswordDialogClearBtn = document.getElementById("academicUserPasswordDialogClearBtn");
        var userPasswordDialogSaveBtn = document.getElementById("academicUserPasswordDialogSaveBtn");
        var userDefaultPasswordInput = document.getElementById("academicUserDefaultPasswordInput");
        var userConfirmDialog = document.getElementById("academicUserConfirmDialog");
        var userConfirmTitle = document.getElementById("academicUserConfirmTitle");
        var userConfirmMessage = document.getElementById("academicUserConfirmMessage");
        var userConfirmCancelBtn = document.getElementById("academicUserConfirmCancelBtn");
        var userConfirmSubmitBtn = document.getElementById("academicUserConfirmSubmitBtn");

        var state = {
            courses: [],
            selectedEditCourseId: "",
            selectedEditCourseTeachers: [],
            selectedEditCourseAssistants: [],
            selectedEditCourseMembers: [],
            coursePage: 1,
            coursePageSize: 8,
            memberPickerMode: "student",
            memberPickerPage: 1,
            memberPickerPageSize: 12,
            memberPickerTotal: 0,
            memberPickerRows: [],
            memberPickerImportedMode: false,
            memberPickerSelection: {
                student: [],
                teacher: [],
            },
            selectedStudentMemberId: "",
            userDirectoryMode: "student",
            userDirectoryPage: 1,
            userDirectoryPageSize: 10,
            userDirectoryTotal: 0,
            userDirectoryRows: [],
            selectedUserDirectoryId: "",
            userDirectorySelectedIds: [],
            userDialogMode: "detail",
            userBatchDialogMode: "student",
            userBatchSelectedFile: null,
            userDirectoryStats: {
                student: 0,
                teacher: 0,
                assistant: 0,
            },
            userDefaultPassword: "",
            userConfirmAction: null,
        };

        var USER_DEFAULT_PASSWORD_STORAGE_KEY = "linksee_academic_user_default_password";

        if (!list || !window.linkseeApi) {
            return;
        }

        function isAcademicModalVisible(node) {
            return !!node && !node.hidden;
        }

        function mountAcademicModal(node) {
            if (!node || !document.body || node.parentElement === document.body) return;
            document.body.appendChild(node);
        }

        function syncAcademicModalOpen() {
            if (!document.body) return;
            document.body.classList.toggle(
                "academic-modal-open",
                isAcademicModalVisible(memberPicker) || isAcademicModalVisible(studentDetail)
            );
        }

        function showAcademicModal(node) {
            if (!node) return;
            mountAcademicModal(node);
            node.hidden = false;
            syncAcademicModalOpen();
        }

        function hideAcademicModal(node) {
            if (!node) return;
            node.hidden = true;
            syncAcademicModalOpen();
        }

        initStudentTaxonomyControls();
        bindStudentTaxonomyControls();
        loadUserDefaultPasswordSetting();

        function defaultAvatarUrl() {
            var origin = window.location.origin && window.location.origin !== "null"
                ? window.location.origin.replace(/\/$/, "")
                : "";
            return (origin || "http://localhost:3001") + "/demo/default-avatar-gray.svg";
        }

        function buildGradeChoices() {
            var currentYear = new Date().getFullYear();
            var rows = [];
            for (var year = currentYear + 1; year >= currentYear - 6; year -= 1) {
                rows.push(String(year));
            }
            return rows;
        }

        function setSelectOptions(select, options, placeholder, value) {
            if (!select) return;
            var html = ['<option value="">' + escapeHtml(placeholder) + '</option>'].concat(
                (options || []).map(function (item) {
                    var optionValue = typeof item === "string" ? item : item.value;
                    var optionLabel = typeof item === "string" ? item : (item.label || item.value);
                    var selected = value !== undefined && String(value) === String(optionValue) ? ' selected' : '';
                    return '<option value="' + escapeHtml(optionValue) + '"' + selected + '>' + escapeHtml(optionLabel) + '</option>';
                })
            );
            select.innerHTML = html.join("");
        }

        function getMajorShortCode(major) {
            var matched = STUDENT_MAJOR_CATALOG.find(function (item) {
                return item.value === String(major || "");
            });
            return matched ? matched.shortCode : "";
        }

        function buildAdminClassChoices(grade, major, currentValue) {
            var gradeValue = String(grade || "").trim();
            var majorValue = String(major || "").trim();
            var shortCode = getMajorShortCode(majorValue);
            if (!gradeValue || !majorValue || !shortCode) {
                return currentValue ? [{ value: String(currentValue), label: String(currentValue) + "（现有）" }] : [];
            }

            var suffix = gradeValue.slice(-2);
            var rows = [];
            for (var index = 1; index <= 6; index += 1) {
                var section = String(index).padStart(2, "0");
                rows.push({ value: shortCode + suffix + section, label: shortCode + suffix + section });
            }
            if (currentValue && !rows.some(function (item) { return item.value === String(currentValue); })) {
                rows.unshift({ value: String(currentValue), label: String(currentValue) + "（现有）" });
            }
            return rows;
        }

        function syncStudentAdminClassSelect(select, grade, major, currentValue, placeholder) {
            if (!select) return;
            var ready = String(grade || "").trim() && String(major || "").trim();
            var options = buildAdminClassChoices(grade, major, currentValue);
            setSelectOptions(select, options, ready ? placeholder : "请先选择年级和专业", currentValue);
            select.disabled = !ready && !options.length;
        }

        function initStudentTaxonomyControls() {
            var gradeChoices = buildGradeChoices();
            setSelectOptions(memberStudentGrade, gradeChoices, "全部年级", memberStudentGrade && memberStudentGrade.value);
            setSelectOptions(
                memberStudentMajor,
                STUDENT_MAJOR_CATALOG.map(function (item) { return item.value; }),
                "全部专业",
                memberStudentMajor && memberStudentMajor.value
            );
            setSelectOptions(
                userStudentGrade,
                gradeChoices,
                "全部年级",
                userStudentGrade && userStudentGrade.value
            );
            setSelectOptions(
                userStudentMajor,
                STUDENT_MAJOR_CATALOG.map(function (item) { return item.value; }),
                "全部专业",
                userStudentMajor && userStudentMajor.value
            );
            setSelectOptions(
                userStudentCohort,
                gradeChoices,
                "全部届次",
                userStudentCohort && userStudentCohort.value
            );
            syncStudentAdminClassSelect(
                memberStudentAdminClass,
                memberStudentGrade && memberStudentGrade.value,
                memberStudentMajor && memberStudentMajor.value,
                memberStudentAdminClass && memberStudentAdminClass.value,
                "全部行政班"
            );
            syncStudentAdminClassSelect(
                userStudentAdminClass,
                userStudentGrade && userStudentGrade.value,
                userStudentMajor && userStudentMajor.value,
                userStudentAdminClass && userStudentAdminClass.value,
                "全部行政班"
            );

            setSelectOptions(studentDetailGrade, gradeChoices, "请选择年级", studentDetailGrade && studentDetailGrade.value);
            setSelectOptions(
                studentDetailMajor,
                STUDENT_MAJOR_CATALOG.map(function (item) { return item.value; }),
                "请选择专业",
                studentDetailMajor && studentDetailMajor.value
            );
            syncStudentAdminClassSelect(
                studentDetailAdminClass,
                studentDetailGrade && studentDetailGrade.value,
                studentDetailMajor && studentDetailMajor.value,
                studentDetailAdminClass && studentDetailAdminClass.value,
                "请选择行政班"
            );
        }

        function bindStudentTaxonomyControls() {
            if (memberStudentGrade) {
                memberStudentGrade.addEventListener("change", function () {
                    syncStudentAdminClassSelect(memberStudentAdminClass, memberStudentGrade.value, memberStudentMajor && memberStudentMajor.value, "", "全部行政班");
                });
            }
            if (userStudentGrade) {
                userStudentGrade.addEventListener("change", function () {
                    syncStudentAdminClassSelect(userStudentAdminClass, userStudentGrade.value, userStudentMajor && userStudentMajor.value, "", "全部行政班");
                });
            }
            if (memberStudentMajor) {
                memberStudentMajor.addEventListener("change", function () {
                    syncStudentAdminClassSelect(memberStudentAdminClass, memberStudentGrade && memberStudentGrade.value, memberStudentMajor.value, "", "全部行政班");
                });
            }
            if (userStudentMajor) {
                userStudentMajor.addEventListener("change", function () {
                    syncStudentAdminClassSelect(userStudentAdminClass, userStudentGrade && userStudentGrade.value, userStudentMajor.value, "", "全部行政班");
                });
            }
            if (studentDetailGrade) {
                studentDetailGrade.addEventListener("change", function () {
                    syncStudentAdminClassSelect(studentDetailAdminClass, studentDetailGrade.value, studentDetailMajor && studentDetailMajor.value, "", "请选择行政班");
                });
            }
            if (studentDetailMajor) {
                studentDetailMajor.addEventListener("change", function () {
                    syncStudentAdminClassSelect(studentDetailAdminClass, studentDetailGrade && studentDetailGrade.value, studentDetailMajor.value, "", "请选择行政班");
                });
            }
        }

        function renderAvatar(url, name, variantClass) {
            var safeName = escapeHtml(name || "--");
            var safeUrl = escapeHtml(url || defaultAvatarUrl());
            var safeDefaultUrl = escapeHtml(defaultAvatarUrl());
            var classes = "academic-avatar-chip" + (variantClass ? " " + variantClass : "");
            var fallbackScript = "if(this.dataset.fallback!=='1'){this.dataset.fallback='1';this.src='" + safeDefaultUrl + "';}";
            return '<span class="' + classes + '"><img class="academic-avatar-photo" src="' + safeUrl + '" alt="' + safeName + '" onerror="' + fallbackScript + '" /></span>';
        }

        function findSelectedStudentMember() {
            var targetId = String(state.selectedStudentMemberId || "");
            return (state.selectedEditCourseMembers || []).find(function (member) {
                return member && member.user && String(member.user.id || "") === targetId;
            }) || null;
        }

        function openStudentDetail(userId) {
            var selected = (state.selectedEditCourseMembers || []).find(function (member) {
                return member && member.user && String(member.user.id || "") === String(userId || "");
            }) || null;
            if (!selected || !studentDetail) return;

            var user = selected.user || {};
            var profile = user.profile || {};
            var studentProfile = user.studentProfile || {};
            state.selectedStudentMemberId = String(user.id || "");
            if (studentDetailName) studentDetailName.value = String(profile.realName || "");
            if (studentDetailStuNo) studentDetailStuNo.value = String(profile.accountNo || studentProfile.stuNo || user.id || "");
            setSelectOptions(studentDetailGrade, buildGradeChoices(), "请选择年级", String(studentProfile.grade || ""));
            setSelectOptions(
                studentDetailMajor,
                STUDENT_MAJOR_CATALOG.map(function (item) { return item.value; }),
                "请选择专业",
                String(studentProfile.major || "")
            );
            syncStudentAdminClassSelect(studentDetailAdminClass, studentProfile.grade, studentProfile.major, String(studentProfile.adminClass || ""), "请选择行政班");
            showAcademicModal(studentDetail);
        }

        function closeStudentDetail() {
            state.selectedStudentMemberId = "";
            hideAcademicModal(studentDetail);
        }

        function openPanel(panelId) {
            var target = document.querySelector('.side-nav .nav-item[data-target="' + panelId + '"]');
            if (target) {
                target.click();
            }
        }

        function scrollEditorIntoView() {
            openPanel("panel-courses");
            window.requestAnimationFrame(function () {
                window.requestAnimationFrame(function () {
                    var editSection = document.querySelector("#panel-courses .academic-course-editor-section");
                    var workspace = document.querySelector(".workspace");
                    if (editSection && typeof editSection.scrollIntoView === "function") {
                        editSection.scrollIntoView({ behavior: "smooth", block: "start" });
                    }
                    if (!editSection || !workspace) {
                        return;
                    }

                    var workspaceRect = workspace.getBoundingClientRect();
                    var sectionRect = editSection.getBoundingClientRect();
                    var targetTop = workspace.scrollTop + (sectionRect.top - workspaceRect.top) - 18;
                    if (typeof workspace.scrollTo === "function") {
                        workspace.scrollTo({
                            top: Math.max(0, targetTop),
                            behavior: "smooth",
                        });
                        return;
                    }
                    workspace.scrollTop = Math.max(0, targetTop);
                });
            });
        }

        function normalizeCsvLines(value) {
            return String(value || "")
                .split(/\r?\n/)
                .map(function (line) { return line.trim(); })
                .filter(Boolean)
                .map(function (line) {
                    return line.split(",").map(function (item) { return item.trim(); });
                });
        }

        function getStatusLabel(status) {
            if (status === "active") return "进行中";
            if (status === "draft") return "草稿";
            if (status === "archived") return "已存档";
            return status || "--";
        }

        function getStatusBadgeClass(status) {
            if (status === "active") return "badge badge-active";
            if (status === "draft") return "badge badge-pending";
            if (status === "archived") return "badge badge-draft";
            return "badge badge-submitted";
        }

        function getSelectedEditCourse() {
            var selectedId = state.selectedEditCourseId || editCourseSelect && editCourseSelect.value || "";
            return state.courses.find(function (item) {
                return String(item.id) === String(selectedId);
            }) || null;
        }

        function formatTerm(course) {
            var year = course && course.academicYear ? String(course.academicYear) : "--";
            var semester = course && course.semester ? String(course.semester) : "--";
            return year + " / 第 " + semester + " 学期";
        }

        function personMonogram(name) {
            var clean = String(name || "").trim();
            if (!clean) return "未";
            return clean.slice(0, 1).toUpperCase();
        }

        function boundTeacherIds() {
            return new Set((state.selectedEditCourseTeachers || []).map(function (row) {
                return row && row.user && row.user.id ? String(row.user.id) : "";
            }).filter(Boolean));
        }

        function boundStudentIds() {
            return new Set((state.selectedEditCourseMembers || []).map(function (row) {
                return row && row.user && row.user.id ? String(row.user.id) : "";
            }).filter(Boolean));
        }

        function getSelectedIds(mode) {
            return new Set((state.memberPickerSelection[mode] || []).map(function (id) { return String(id); }));
        }

        function setSelectedIds(mode, values) {
            state.memberPickerSelection[mode] = Array.from(new Set((values || []).map(function (id) { return String(id); })));
        }

        function buildQuery(params) {
            var search = new URLSearchParams();
            Object.keys(params).forEach(function (key) {
                var value = params[key];
                if (value !== undefined && value !== null && String(value).trim() !== "") {
                    search.set(key, String(value).trim());
                }
            });
            return search.toString();
        }

        function searchDirectory(params) {
            var query = buildQuery(params);
            return window.linkseeApi.getJson("/api/v1/users/directory" + (query ? "?" + query : ""));
        }

        function currentAddedOnlyFlag() {
            return state.memberPickerMode === "student"
                ? Boolean(memberStudentAddedOnly && memberStudentAddedOnly.checked)
                : Boolean(memberTeacherAddedOnly && memberTeacherAddedOnly.checked);
        }

        function currentBoundIdSet() {
            return state.memberPickerMode === "student" ? boundStudentIds() : boundTeacherIds();
        }

        function currentFilters() {
            if (state.memberPickerMode === "student") {
                return {
                    role: "student",
                    realName: memberStudentName && memberStudentName.value,
                    accountNo: memberStudentStuNo && memberStudentStuNo.value,
                    grade: memberStudentGrade && memberStudentGrade.value,
                    major: memberStudentMajor && memberStudentMajor.value,
                    adminClass: memberStudentAdminClass && memberStudentAdminClass.value,
                };
            }
            return {
                role: "teacher",
                realName: memberTeacherName && memberTeacherName.value,
                teacherNo: memberTeacherNo && memberTeacherNo.value,
                college: memberTeacherCollege && memberTeacherCollege.value,
            };
        }

        function matchesMemberFilter(value, keyword) {
            if (!keyword && keyword !== 0) return true;
            return String(value || "").toLowerCase().indexOf(String(keyword || "").trim().toLowerCase()) !== -1;
        }

        function buildJoinedStudentRows() {
            var filters = currentFilters();
            return (state.selectedEditCourseMembers || []).map(function (member) {
                return member && member.user ? member.user : null;
            }).filter(function (row) {
                if (!row) return false;
                var profile = row.profile || {};
                var studentProfile = row.studentProfile || {};
                return matchesMemberFilter(profile.realName, filters.realName)
                    && matchesMemberFilter(profile.accountNo || row.id, filters.accountNo)
                    && (!filters.grade || String(studentProfile.grade || "") === String(filters.grade))
                    && (!filters.major || String(studentProfile.major || "") === String(filters.major))
                    && (!filters.adminClass || String(studentProfile.adminClass || "") === String(filters.adminClass));
            });
        }

        function buildJoinedTeacherRows() {
            var filters = currentFilters();
            return (state.selectedEditCourseTeachers || []).map(function (member) {
                return member && member.user ? member.user : null;
            }).filter(function (row) {
                if (!row) return false;
                var profile = row.profile || {};
                var teacherProfile = row.teacherProfile || {};
                return matchesMemberFilter(profile.realName, filters.realName)
                    && matchesMemberFilter(teacherProfile.teacherNo || row.id, filters.teacherNo)
                    && matchesMemberFilter(teacherProfile.college, filters.college);
            });
        }

        function filteredModalRows() {
            var addedOnly = currentAddedOnlyFlag();
            var taken = currentBoundIdSet();
            return (state.memberPickerRows || []).filter(function (row) {
                return !addedOnly || taken.has(String(row.id || ""));
            });
        }

        function leadTeacherLabel(course) {
            var teachers = Array.isArray(course && course.teachers) ? course.teachers : [];
            var lead = teachers.find(function (item) { return item && item.role === "lead"; }) || teachers[0] || null;
            return lead && lead.user && lead.user.profile && lead.user.profile.realName
                ? String(lead.user.profile.realName)
                : "";
        }

        function syncCourseFilterOptions() {
            if (courseYearFilter) {
                var years = Array.from(new Set(state.courses.map(function (course) {
                    return String(course && course.academicYear || "");
                }).filter(Boolean))).sort(function (a, b) { return Number(b) - Number(a); });
                courseYearFilter.innerHTML = ['<option value="">全部学年</option>'].concat(
                    years.map(function (year) {
                        return '<option value="' + escapeHtml(year) + '">' + escapeHtml(year) + ' 学年</option>';
                    })
                ).join("");
            }
        }

        function updateMemberPickerSummary() {
            if (memberSelectionMeta) {
                memberSelectionMeta.textContent = "已选 " + getSelectedIds(state.memberPickerMode).size + " 项";
            }
            if (memberSelectAll) {
                var pageRows = filteredModalRows();
                var selected = getSelectedIds(state.memberPickerMode);
                memberSelectAll.checked = pageRows.length > 0 && pageRows.every(function (row) { return selected.has(String(row.id || "")); });
            }
        }

        function renderMemberPickerPagination() {
            if (!memberPageButtons) return;
            if (state.memberPickerImportedMode) {
                memberPageButtons.innerHTML = "";
                if (memberPrevPageBtn) memberPrevPageBtn.disabled = true;
                if (memberNextPageBtn) memberNextPageBtn.disabled = true;
                return;
            }
            var totalPages = Math.max(1, Math.ceil((state.memberPickerTotal || 0) / state.memberPickerPageSize));
            var current = state.memberPickerPage;
            var buttons = [];
            for (var page = Math.max(1, current - 2); page <= Math.min(totalPages, current + 2); page += 1) {
                buttons.push('<button class="academic-page-btn' + (page === current ? ' is-active' : '') + '" type="button" data-member-page="' + page + '">' + page + '</button>');
            }
            memberPageButtons.innerHTML = buttons.join("") || '<span class="academic-page-empty">1</span>';
            if (memberPrevPageBtn) memberPrevPageBtn.disabled = current <= 1;
            if (memberNextPageBtn) memberNextPageBtn.disabled = current >= totalPages;
        }

        function renderMemberPickerTable() {
            if (!memberPickerTable) return;
            var rows = filteredModalRows();
            var selected = getSelectedIds(state.memberPickerMode);
            var taken = currentBoundIdSet();
            var isStudentMode = state.memberPickerMode === "student";
            var headerHtml = isStudentMode
                ? '<div class="academic-modal-table-header"><span></span><span>学生</span><span>一卡通号</span><span>年级</span><span>专业</span><span>行政班</span><span>状态</span></div>'
                : '<div class="academic-modal-table-header academic-modal-table-header-teacher"><span></span><span>教师</span><span>工号</span><span>学院</span><span>加入角色</span><span>状态</span></div>';
            if (memberPickerTitle) {
                memberPickerTitle.textContent = isStudentMode ? "添加学生" : "添加教师";
            }
            if (memberPickerMeta) {
                memberPickerMeta.textContent = "";
                memberPickerMeta.hidden = true;
            }
            if (!rows.length) {
                memberPickerTable.innerHTML = headerHtml + '<div class="academic-modal-table-empty">暂无结果</div>';
                updateMemberPickerSummary();
                renderMemberPickerPagination();
                return;
            }
            if (isStudentMode) {
                memberPickerTable.innerHTML = [
                    headerHtml,
                    rows.map(function (row) {
                        var profile = row.profile || {};
                        var studentProfile = row.studentProfile || {};
                        var id = String(row.id || "");
                        var joined = taken.has(id);
                        var importStatus = String(row.importStatus || "");
                        var statusLabel = joined ? "已加入" : "待加入";
                        if (importStatus === "name_mismatch") {
                            statusLabel = "姓名不符";
                        } else if (importStatus === "ready") {
                            statusLabel = "已勾选";
                        } else if (importStatus === "already_joined") {
                            statusLabel = "已加入";
                        }
                        return '<label class="academic-modal-table-row"><span><input type="checkbox" data-member-select="' + escapeHtml(id) + '"' + (selected.has(id) ? ' checked' : '') + (joined || importStatus === "name_mismatch" ? ' disabled' : '') + ' /></span><span class="academic-modal-person"><span class="academic-avatar-chip is-assistant">' + escapeHtml(personMonogram(profile.realName)) + '</span><span class="academic-modal-copy"><strong>' + escapeHtml(profile.realName || "--") + '</strong><small>一卡通号 ' + escapeHtml(profile.accountNo || id) + '</small></span></span><span>' + escapeHtml(profile.accountNo || id || "--") + '</span><span>' + escapeHtml(String(studentProfile.grade || "--")) + '</span><span>' + escapeHtml(studentProfile.major || "--") + '</span><span>' + escapeHtml(studentProfile.adminClass || "--") + '</span><span class="academic-modal-status">' + statusLabel + '</span></label>';
                    }).join(""),
                ].join("");
            } else {
                memberPickerTable.innerHTML = [
                    headerHtml,
                    rows.map(function (row) {
                        var profile = row.profile || {};
                        var teacherProfile = row.teacherProfile || {};
                        var id = String(row.id || "");
                        var joined = taken.has(id);
                        return '<label class="academic-modal-table-row academic-modal-table-row-teacher"><span><input type="checkbox" data-member-select="' + escapeHtml(id) + '"' + (selected.has(id) ? ' checked' : '') + (joined ? ' disabled' : '') + ' /></span><span class="academic-modal-person"><span class="academic-avatar-chip">' + escapeHtml(personMonogram(profile.realName)) + '</span><span class="academic-modal-copy"><strong>' + escapeHtml(profile.realName || "--") + '</strong><small>ID ' + escapeHtml(id) + '</small></span></span><span>' + escapeHtml(teacherProfile.teacherNo || "--") + '</span><span>' + escapeHtml(teacherProfile.college || "--") + '</span><span>' + escapeHtml(memberTeacherRole ? memberTeacherRole.value === "lead" ? "主讲教师" : "协同教师" : "主讲教师") + '</span><span class="academic-modal-status">' + (joined ? '已加入' : '待加入') + '</span></label>';
                    }).join(""),
                ].join("");
            }
            updateMemberPickerSummary();
            renderMemberPickerPagination();
        }

        function syncMemberPickerTabs() {
            if (memberTabStudent) memberTabStudent.classList.toggle("is-active", state.memberPickerMode === "student");
            if (memberTabTeacher) memberTabTeacher.classList.toggle("is-active", state.memberPickerMode === "teacher");
            if (memberTabStudent) memberTabStudent.hidden = false;
            if (memberStudentFilters) memberStudentFilters.hidden = state.memberPickerMode !== "student";
            if (memberTeacherFilters) memberTeacherFilters.hidden = state.memberPickerMode !== "teacher";
            if (rosterImportBtn) rosterImportBtn.hidden = state.memberPickerMode !== "student";
        }

        function openMemberPicker(mode) {
            state.memberPickerMode = mode || "student";
            state.memberPickerPage = 1;
            syncMemberPickerTabs();
            showAcademicModal(memberPicker);
            loadMemberDirectory().catch(function (err) {
                showResult(courseRelationResult, "加载失败", err.message || "成员目录加载失败。", true);
            });
        }

        function closeMemberPicker() {
            hideAcademicModal(memberPicker);
        }

        async function loadMemberDirectory() {
            state.memberPickerImportedMode = false;
            if (currentAddedOnlyFlag()) {
                state.memberPickerRows = state.memberPickerMode === "student"
                    ? buildJoinedStudentRows()
                    : buildJoinedTeacherRows();
                state.memberPickerTotal = state.memberPickerRows.length;
                renderMemberPickerTable();
                return;
            }
            var filters = currentFilters();
            var payload = await searchDirectory({
                role: filters.role,
                realName: filters.realName,
                accountNo: filters.accountNo,
                grade: filters.grade,
                major: filters.major,
                adminClass: filters.adminClass,
                teacherNo: filters.teacherNo,
                college: filters.college,
                page: state.memberPickerPage,
                limit: state.memberPickerPageSize,
            });
            state.memberPickerRows = Array.isArray(payload.data) ? payload.data : [];
            state.memberPickerTotal = payload.paging && payload.paging.total ? Number(payload.paging.total) : state.memberPickerRows.length;
            renderMemberPickerTable();
        }

        function renderCourses() {
            var search = courseSearch && courseSearch.value ? courseSearch.value.trim().toLowerCase() : "";
            var teacherSearch = courseTeacherFilter && courseTeacherFilter.value ? courseTeacherFilter.value.trim().toLowerCase() : "";
            var selectedYear = courseYearFilter && courseYearFilter.value ? String(courseYearFilter.value) : "";
            var selectedSemester = courseSemesterFilter && courseSemesterFilter.value ? String(courseSemesterFilter.value) : "";
            var statusMap = { "全部状态": "", "进行中": "active", "草稿": "draft", "已存档": "archived" };
            var selectedStatus = courseStatusFilter ? statusMap[courseStatusFilter.value] || "" : "";
            var filtered = state.courses.filter(function (course) {
                var teacherLabel = leadTeacherLabel(course);
                var matchesSearch = !search
                    || String(course.name || "").toLowerCase().indexOf(search) !== -1
                    || String(course.courseNo || course.id || "").toLowerCase().indexOf(search) !== -1;
                var matchesTeacher = !teacherSearch
                    || String(teacherLabel || "").toLowerCase().indexOf(teacherSearch) !== -1;
                var matchesYear = !selectedYear || String(course.academicYear || "") === selectedYear;
                var matchesSemester = !selectedSemester || String(course.semester || "") === selectedSemester;
                var matchesStatus = !selectedStatus || course.status === selectedStatus;
                return matchesSearch && matchesTeacher && matchesYear && matchesSemester && matchesStatus;
            });

            list.querySelectorAll(".data-grid-row").forEach(function (row) {
                row.remove();
            });

            var totalPages = Math.max(1, Math.ceil(filtered.length / state.coursePageSize));
            if (state.coursePage > totalPages) {
                state.coursePage = totalPages;
            }
            var startIndex = (state.coursePage - 1) * state.coursePageSize;
            var pagedCourses = filtered.slice(startIndex, startIndex + state.coursePageSize);

            if (courseMeta) {
                var tags = [
                    '<span>当前结果 ' + filtered.length + ' / ' + state.courses.length + '</span>',
                    '<span class="dashboard-filter-tag">状态: ' + escapeHtml(courseStatusFilter ? courseStatusFilter.value : "全部状态") + '</span>'
                ];
                if (selectedYear) tags.push('<span class="dashboard-filter-tag">学年: ' + escapeHtml(selectedYear) + '</span>');
                if (selectedSemester) tags.push('<span class="dashboard-filter-tag">学期: 第 ' + escapeHtml(selectedSemester) + ' 学期</span>');
                if (teacherSearch) tags.push('<span class="dashboard-filter-tag">教师: ' + escapeHtml(courseTeacherFilter.value.trim()) + '</span>');
                courseMeta.innerHTML = tags.join("");
            }
            if (courseNote) {
                courseNote.textContent = filtered.length ? ("第 " + state.coursePage + " / " + totalPages + " 页，每页 8 条") : "";
            }
            if (!filtered.length) {
                if (empty) empty.hidden = false;
                if (coursePagination) coursePagination.hidden = true;
                return;
            }
            if (empty) empty.hidden = true;

            list.insertAdjacentHTML("beforeend", pagedCourses.map(function (course) {
                var teacherLabel = leadTeacherLabel(course) || "未分配教师";
                return [
                    '<div class="data-grid-row academic-course-row">',
                    '<span><span class="academic-code-pill">' + escapeHtml(String(course.courseNo || course.id || "--")) + '</span></span>',
                    '<span class="academic-course-title-cell"><strong>' + escapeHtml(String(course.name || "--")) + '</strong><small>' + escapeHtml(String(course.description || "未填写课程简介")) + '</small></span>',
                    '<span class="academic-course-teacher-cell"><strong>' + escapeHtml(teacherLabel) + '</strong><small>' + escapeHtml(teacherLabel === "未分配教师" ? "待配置课程教师" : "当前主讲教师") + '</small></span>',
                    '<span class="academic-course-term-cell"><span class="academic-meta-dot"></span>' + escapeHtml(formatTerm(course)) + "</span>",
                    '<span><span class="' + getStatusBadgeClass(course.status) + '">' + escapeHtml(getStatusLabel(course.status)) + "</span></span>",
                    '<span class="academic-course-action-cell"><button class="btn btn-secondary academic-row-action" type="button" data-course-edit="' + escapeHtml(String(course.id || "")) + '">编辑</button></span>',
                    "</div>",
                ].join("");
            }).join(""));

            renderCoursePagination(filtered.length, totalPages);

            syncCourseSelectors();
        }

        function renderCoursePagination(totalCount, totalPages) {
            if (!coursePagination || !coursePageButtons) return;
            coursePagination.hidden = totalCount <= state.coursePageSize;

            var current = state.coursePage;
            var buttons = [];
            for (var page = Math.max(1, current - 2); page <= Math.min(totalPages, current + 2); page += 1) {
                buttons.push('<button class="academic-page-btn' + (page === current ? ' is-active' : '') + '" type="button" data-course-page="' + page + '">' + page + '</button>');
            }
            coursePageButtons.innerHTML = buttons.join("") || '<span class="academic-page-empty">1</span>';
            if (coursePrevPageBtn) coursePrevPageBtn.disabled = current <= 1;
            if (courseNextPageBtn) courseNextPageBtn.disabled = current >= totalPages;
        }

        function syncUserDirectoryTabs() {
            if (userTabStudent) userTabStudent.classList.toggle("is-active", state.userDirectoryMode === "student");
            if (userTabTeacher) userTabTeacher.classList.toggle("is-active", state.userDirectoryMode === "teacher");
            if (userTabAssistant) userTabAssistant.classList.toggle("is-active", state.userDirectoryMode === "assistant");
            if (userStudentFilters) userStudentFilters.hidden = state.userDirectoryMode !== "student";
            if (userTeacherFilters) userTeacherFilters.hidden = state.userDirectoryMode !== "teacher";
            if (userAssistantFilters) userAssistantFilters.hidden = state.userDirectoryMode !== "assistant";
            if (userCreateBtn) userCreateBtn.hidden = state.userDirectoryMode === "assistant";
        }

        function currentUserDirectoryFilters() {
            if (state.userDirectoryMode === "student") {
                return {
                    role: "student",
                    keyword: userStudentKeyword && userStudentKeyword.value.trim(),
                    grade: userStudentGrade && userStudentGrade.value,
                    major: userStudentMajor && userStudentMajor.value,
                    adminClass: userStudentAdminClass && userStudentAdminClass.value,
                    cohort: userStudentCohort && userStudentCohort.value,
                };
            }
            if (state.userDirectoryMode === "teacher") {
                return {
                    role: "teacher",
                    keyword: userTeacherKeyword && userTeacherKeyword.value.trim(),
                    college: userTeacherCollege && userTeacherCollege.value.trim(),
                    title: userTeacherTitle && userTeacherTitle.value.trim(),
                };
            }
            return {
                role: "assistant",
                keyword: userAssistantKeyword && userAssistantKeyword.value.trim(),
                ownerTeacherName: userAssistantOwner && userAssistantOwner.value.trim(),
            };
        }

        function currentUserDirectoryRow() {
            var targetId = String(state.selectedUserDirectoryId || "");
            return (state.userDirectoryRows || []).find(function (row) {
                return row && String(row.id || "") === targetId;
            }) || null;
        }

        function getUserDefaultPassword() {
            return String(state.userDefaultPassword || "").trim();
        }

        function syncUserDefaultPasswordButton() {
            if (!userDefaultPasswordBtn) return;
            var password = getUserDefaultPassword();
            userDefaultPasswordBtn.textContent = password ? "默认密码已设置" : "默认密码设置";
            userDefaultPasswordBtn.title = password
                ? "当前已配置默认密码，点击可修改或清空"
                : "点击配置默认密码";
        }

        function loadUserDefaultPasswordSetting() {
            try {
                state.userDefaultPassword = window.localStorage.getItem(USER_DEFAULT_PASSWORD_STORAGE_KEY) || "";
            } catch (error) {
                state.userDefaultPassword = "";
            }
            syncUserDefaultPasswordButton();
        }

        function persistUserDefaultPassword(value) {
            var nextValue = String(value || "").trim();
            state.userDefaultPassword = nextValue;
            try {
                if (nextValue) {
                    window.localStorage.setItem(USER_DEFAULT_PASSWORD_STORAGE_KEY, nextValue);
                } else {
                    window.localStorage.removeItem(USER_DEFAULT_PASSWORD_STORAGE_KEY);
                }
            } catch (error) {
                // Ignore localStorage failures and keep runtime state only.
            }
            syncUserDefaultPasswordButton();
        }

        function selectedUserDirectoryIds() {
            return Array.isArray(state.userDirectorySelectedIds)
                ? state.userDirectorySelectedIds.map(function (id) { return String(id); }).filter(Boolean)
                : [];
        }

        function syncUserDirectoryActionButtons() {
            var selectedIds = selectedUserDirectoryIds();
            if (userResetBtn) userResetBtn.disabled = !selectedIds.length;
        }

        function notifyUserDirectoryAction(title, message, isError) {
            if (typeof window.linkseeDashboardToast === "function") {
                window.linkseeDashboardToast(title, message, isError);
                return;
            }
            window.alert(title + "\n" + message);
        }

        function downloadBlobFile(filename, blob) {
            var url = URL.createObjectURL(blob);
            var link = document.createElement("a");
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.setTimeout(function () {
                URL.revokeObjectURL(url);
            }, 1200);
        }

        function currentExportFilename(format) {
            var suffix = format || "xlsx";
            var prefix = state.userDirectoryMode === "student"
                ? "students"
                : state.userDirectoryMode === "teacher"
                    ? "teachers"
                    : "assistants";
            return "linksee-user-directory-" + prefix + "." + suffix;
        }

        async function exportUserDirectory(format) {
            if (!userExportBtn) return;
            userExportBtn.disabled = true;
            try {
                var filters = currentUserDirectoryFilters();
                var query = buildQuery({
                    role: filters.role,
                    keyword: filters.keyword,
                    realName: filters.realName,
                    accountNo: filters.accountNo,
                    grade: filters.grade,
                    major: filters.major,
                    adminClass: filters.adminClass,
                    teacherNo: filters.teacherNo,
                    college: filters.college,
                    title: filters.title,
                    ownerTeacherName: filters.ownerTeacherName,
                    cohort: filters.cohort,
                    format: format || "xlsx",
                });
                var blob = await window.linkseeApi.getBlob("/api/v1/users/export?" + query);
                downloadBlobFile(currentExportFilename(format || "xlsx"), blob);
                notifyUserDirectoryAction("导出成功", "已生成 " + String((format || "xlsx").toUpperCase()) + " 文件。", false);
            } catch (error) {
                notifyUserDirectoryAction("导出失败", error && error.message ? error.message : "用户目录导出失败。", true);
            } finally {
                userExportBtn.disabled = false;
                syncUserDirectoryActionButtons();
            }
        }

        function setUserDirectorySelectedIds(values) {
            state.userDirectorySelectedIds = Array.from(new Set((values || []).map(function (id) { return String(id); }).filter(Boolean)));
        }

        function toggleFloatMenu(menu, button) {
            if (!menu || !button) return;
            var nextHidden = !menu.hidden;
            if (userImportMenu) userImportMenu.hidden = true;
            if (userExportMenu) userExportMenu.hidden = true;
            if (userImportBtn) userImportBtn.setAttribute("aria-expanded", "false");
            if (userExportBtn) userExportBtn.setAttribute("aria-expanded", "false");
            menu.hidden = nextHidden;
            button.setAttribute("aria-expanded", String(!nextHidden));
        }

        function closeUserFloatMenus() {
            if (userImportMenu) userImportMenu.hidden = true;
            if (userExportMenu) userExportMenu.hidden = true;
            if (userImportBtn) userImportBtn.setAttribute("aria-expanded", "false");
            if (userExportBtn) userExportBtn.setAttribute("aria-expanded", "false");
        }

        function openUserPasswordDialog() {
            if (userDefaultPasswordInput) {
                userDefaultPasswordInput.value = getUserDefaultPassword();
            }
            if (userPasswordDialog) userPasswordDialog.hidden = false;
        }

        function closeUserPasswordDialog() {
            if (userPasswordDialog) userPasswordDialog.hidden = true;
        }

        function openUserCreateDialog() {
            if (!userCreateDialog || !userCreateDialogBody) return;
            if (state.userDirectoryMode === "assistant") {
                notifyUserDirectoryAction("当前不可新建", "教师子账号只能查看和修改，不能由教务处直接新建。", true);
                return;
            }
            if (userCreateDialogTitle) {
                userCreateDialogTitle.textContent = state.userDirectoryMode === "student"
                    ? "新建学生"
                    : state.userDirectoryMode === "teacher"
                        ? "新建教师"
                        : "新建用户";
            }
            if (userCreateDialogMeta) {
                userCreateDialogMeta.textContent = "新建后默认要求用户首次登录修改密码";
            }
            if (state.userDirectoryMode === "student") {
                userCreateDialogBody.innerHTML = [
                    '<div class="academic-user-dialog-grid">',
                    '<label class="academic-user-dialog-field"><span>一卡通号</span><input id="academicUserCreateId" class="dashboard-input" placeholder="10 位一卡通号" /></label>',
                    '<label class="academic-user-dialog-field"><span>姓名</span><input id="academicUserCreateRealName" class="dashboard-input" placeholder="请输入姓名" /></label>',
                    '<label class="academic-user-dialog-field"><span>年级</span><select id="academicUserCreateGrade" class="dashboard-select"><option value="">请选择年级</option></select></label>',
                    '<label class="academic-user-dialog-field"><span>届次</span><select id="academicUserCreateCohort" class="dashboard-select"><option value="">请选择届次</option></select></label>',
                    '<label class="academic-user-dialog-field"><span>专业</span><select id="academicUserCreateMajor" class="dashboard-select"><option value="">请选择专业</option></select></label>',
                    '<label class="academic-user-dialog-field"><span>行政班</span><select id="academicUserCreateAdminClass" class="dashboard-select" disabled><option value="">请先选择年级和专业</option></select></label>',
                    '</div>'
                ].join("");
                var createGrade = document.getElementById("academicUserCreateGrade");
                var createCohort = document.getElementById("academicUserCreateCohort");
                var createMajor = document.getElementById("academicUserCreateMajor");
                var createAdminClass = document.getElementById("academicUserCreateAdminClass");
                setSelectOptions(createGrade, buildGradeChoices(), "请选择年级");
                setSelectOptions(createCohort, buildGradeChoices(), "请选择届次");
                setSelectOptions(createMajor, STUDENT_MAJOR_CATALOG.map(function (item) { return item.value; }), "请选择专业");
                if (createGrade) {
                    createGrade.addEventListener("change", function () {
                        syncStudentAdminClassSelect(createAdminClass, createGrade.value, createMajor && createMajor.value, "", "请选择行政班");
                    });
                }
                if (createMajor) {
                    createMajor.addEventListener("change", function () {
                        syncStudentAdminClassSelect(createAdminClass, createGrade && createGrade.value, createMajor.value, "", "请选择行政班");
                    });
                }
            } else if (state.userDirectoryMode === "teacher") {
                userCreateDialogBody.innerHTML = [
                    '<div class="academic-user-dialog-grid">',
                    '<label class="academic-user-dialog-field"><span>一卡通号</span><input id="academicUserCreateId" class="dashboard-input" placeholder="10 位一卡通号" /></label>',
                    '<label class="academic-user-dialog-field"><span>姓名</span><input id="academicUserCreateRealName" class="dashboard-input" placeholder="请输入姓名" /></label>',
                    '<label class="academic-user-dialog-field"><span>工号</span><input id="academicUserCreateTeacherNo" class="dashboard-input" placeholder="请输入工号" /></label>',
                    '<label class="academic-user-dialog-field"><span>学院</span><input id="academicUserCreateCollege" class="dashboard-input" placeholder="请输入学院" /></label>',
                    '<label class="academic-user-dialog-field"><span>职称</span><input id="academicUserCreateTitle" class="dashboard-input" placeholder="请输入职称" /></label>',
                    '<label class="academic-user-dialog-field academic-user-dialog-field-wide"><span>研究方向</span><textarea id="academicUserCreateResearchDirection" class="dashboard-textarea" placeholder="可选"></textarea></label>',
                    '</div>'
                ].join("");
            }
            userCreateDialog.hidden = false;
        }

        function closeUserCreateDialog() {
            if (userCreateDialog) userCreateDialog.hidden = true;
            if (userCreateDialogBody) userCreateDialogBody.innerHTML = "";
        }

        function openUserConfirmDialog(title, message, action) {
            state.userConfirmAction = action;
            if (userConfirmTitle) userConfirmTitle.textContent = title;
            if (userConfirmMessage) userConfirmMessage.textContent = message;
            if (userConfirmDialog) userConfirmDialog.hidden = false;
        }

        function closeUserConfirmDialog() {
            state.userConfirmAction = null;
            if (userConfirmDialog) userConfirmDialog.hidden = true;
        }

        function openUserBatchDialog(mode) {
            state.userBatchDialogMode = mode;
            state.userBatchSelectedFile = null;
            closeUserFloatMenus();
            if (userBatchDialogTitle) userBatchDialogTitle.textContent = mode === "student" ? "导入学生" : "导入教师";
            if (userBatchDialogMeta) userBatchDialogMeta.textContent = "支持 Excel 常见表格格式，导入成功后自动刷新";
            if (userBatchFormatHint) {
                userBatchFormatHint.textContent = mode === "student"
                    ? "学生表头：一卡通号、姓名、年级、届次、专业、行政班"
                    : "教师表头：一卡通号、姓名、工号、职称、学院、研究方向";
            }
            if (userImportFileName) userImportFileName.textContent = "尚未选择文件";
            if (userImportInput) userImportInput.value = "";
            if (userBatchDialog) userBatchDialog.hidden = false;
            if (typeof window.linkseeDashboardToast === "function") {
                window.linkseeDashboardToast(
                    "导入要求",
                    mode === "student"
                        ? "请上传学生 Excel 文件，表头需包含一卡通号、姓名、年级、届次、专业、行政班。"
                        : "请上传教师 Excel 文件，表头需包含一卡通号、姓名、工号、职称、学院、研究方向。",
                    false
                );
            }
        }

        function closeUserBatchDialog() {
            if (userBatchDialog) userBatchDialog.hidden = true;
        }

        async function submitUserBatchDialog() {
            var file = state.userBatchSelectedFile;
            if (!file) {
                notifyUserDirectoryAction("无法导入", "请先选择需要导入的 Excel 文件。", true);
                return;
            }
            try {
                var buffer = await file.arrayBuffer();
                var binary = "";
                var bytes = new Uint8Array(buffer);
                for (var i = 0; i < bytes.length; i += 1) {
                    binary += String.fromCharCode(bytes[i]);
                }
                var payload = await window.linkseeApi.postJson("/api/v1/users/import-file", {
                    mode: state.userBatchDialogMode === "teacher" ? "teacher" : "student",
                    filename: file.name,
                    fileBase64: window.btoa(binary),
                    defaultPassword: getUserDefaultPassword() || undefined,
                });
                var data = payload && payload.data ? payload.data : {};
                notifyUserDirectoryAction("导入成功", "成功创建 " + String(data.createdCount || 0) + " 条，失败 " + String(data.failedCount || 0) + " 条。", false);
                closeUserBatchDialog();
                await Promise.all([refreshUserDirectoryStats(), loadUserDirectory()]);
            } catch (error) {
                notifyUserDirectoryAction("导入失败", error && error.message ? error.message : "批量导入失败。", true);
            }
        }

        function toggleUserSelection(userId, checked) {
            var current = new Set(selectedUserDirectoryIds());
            if (checked) {
                current.add(String(userId || ""));
            } else {
                current.delete(String(userId || ""));
            }
            setUserDirectorySelectedIds(Array.from(current));
            syncUserDirectoryActionButtons();
        }

        function toggleUserSelectionAll(checked) {
            if (!checked) {
                setUserDirectorySelectedIds([]);
            } else {
                setUserDirectorySelectedIds((state.userDirectoryRows || []).map(function (row) { return String(row.id || ""); }));
            }
            renderUserDirectoryTable();
        }

        async function batchResetSelectedUsers() {
            var selectedIds = selectedUserDirectoryIds();
            if (!selectedIds.length) {
                notifyUserDirectoryAction("请先选择用户", "请先勾选需要重置密码的用户。", true);
                return;
            }
            var body = { userIds: selectedIds };
            var defaultPassword = getUserDefaultPassword();
            if (defaultPassword) body.newPassword = defaultPassword;
            try {
                var payload = await window.linkseeApi.postJson("/api/v1/auth/admin/batch-reset-password", body);
                var data = payload && payload.data ? payload.data : {};
                notifyUserDirectoryAction("批量重置成功", "影响人数：" + String(data.affectedCount || 0) + "，默认密码：" + String(data.defaultPassword || "后端自动生成") + "。", false);
            } catch (error) {
                notifyUserDirectoryAction("批量重置失败", error && error.message ? error.message : "批量重置失败。", true);
            }
        }

        async function submitUserCreateDialog() {
            var idInput = document.getElementById("academicUserCreateId");
            var realNameInput = document.getElementById("academicUserCreateRealName");
            var body = {
                id: idInput && idInput.value.trim(),
                realName: realNameInput && realNameInput.value.trim(),
                role: state.userDirectoryMode,
            };
            if (state.userDirectoryMode === "student") {
                var createGrade = document.getElementById("academicUserCreateGrade");
                var createCohort = document.getElementById("academicUserCreateCohort");
                var createMajor = document.getElementById("academicUserCreateMajor");
                var createAdminClass = document.getElementById("academicUserCreateAdminClass");
                body.stuNo = body.id;
                body.grade = createGrade && createGrade.value;
                body.cohort = createCohort && createCohort.value;
                body.major = createMajor && createMajor.value;
                body.adminClass = createAdminClass && createAdminClass.value;
            } else if (state.userDirectoryMode === "teacher") {
                var createTeacherNo = document.getElementById("academicUserCreateTeacherNo");
                var createCollege = document.getElementById("academicUserCreateCollege");
                var createTitle = document.getElementById("academicUserCreateTitle");
                var createResearchDirection = document.getElementById("academicUserCreateResearchDirection");
                body.teacherNo = createTeacherNo && createTeacherNo.value.trim();
                body.college = createCollege && createCollege.value.trim();
                body.title = createTitle && createTitle.value.trim();
                body.researchDirection = createResearchDirection && createResearchDirection.value.trim();
            }
            var defaultPassword = getUserDefaultPassword();
            if (defaultPassword) body.defaultPassword = defaultPassword;
            try {
                await window.linkseeApi.postJson("/api/v1/users", body);
                closeUserCreateDialog();
                notifyUserDirectoryAction("创建成功", "新用户已创建。", false);
                await Promise.all([refreshUserDirectoryStats(), loadUserDirectory()]);
            } catch (error) {
                notifyUserDirectoryAction("创建失败", error && error.message ? error.message : "新建用户失败。", true);
            }
        }

        function renderUserDirectorySummary() {
            if (!userSummaryMeta) return;
            userSummaryMeta.innerHTML = [
                '<span>共 ' + (state.userDirectoryStats.student + state.userDirectoryStats.teacher + state.userDirectoryStats.assistant) + ' 位用户</span>',
                '<span>学生 ' + state.userDirectoryStats.student + ' 人</span>',
                '<span>教师 ' + state.userDirectoryStats.teacher + ' 人</span>',
                '<span>助教 ' + state.userDirectoryStats.assistant + ' 人</span>'
            ].join("");
        }

        function closeUserDialog() {
            if (!userDialog) return;
            userDialog.hidden = true;
            if (userDialogBody) userDialogBody.innerHTML = "";
        }

        function bindUserDialogStudentTaxonomy() {
            var gradeInput = document.getElementById("academicUserDialogGrade");
            var cohortInput = document.getElementById("academicUserDialogCohort");
            var majorInput = document.getElementById("academicUserDialogMajor");
            var adminClassInput = document.getElementById("academicUserDialogAdminClass");
            setSelectOptions(gradeInput, buildGradeChoices(), "请选择年级", gradeInput && gradeInput.value);
            setSelectOptions(cohortInput, buildGradeChoices(), "请选择届次", cohortInput && cohortInput.value);
            setSelectOptions(
                majorInput,
                STUDENT_MAJOR_CATALOG.map(function (item) { return item.value; }),
                "请选择专业",
                majorInput && majorInput.value
            );
            syncStudentAdminClassSelect(
                adminClassInput,
                gradeInput && gradeInput.value,
                majorInput && majorInput.value,
                adminClassInput && adminClassInput.value,
                "请选择行政班"
            );
            if (state.userDialogMode === "edit") {
                if (gradeInput) {
                    gradeInput.addEventListener("change", function () {
                        syncStudentAdminClassSelect(adminClassInput, gradeInput.value, majorInput && majorInput.value, "", "请选择行政班");
                    });
                }
                if (majorInput) {
                    majorInput.addEventListener("change", function () {
                        syncStudentAdminClassSelect(adminClassInput, gradeInput && gradeInput.value, majorInput.value, "", "请选择行政班");
                    });
                }
            }
        }

        function renderUserDialog(mode) {
            if (!userDialog || !userDialogBody) return;
            var row = currentUserDirectoryRow();
            if (!row) {
                notifyUserDirectoryAction("请先选择用户", "请先在表格中选中一位学生或教师。", true);
                return;
            }
            state.userDialogMode = mode;
            var isEdit = mode === "edit";
            var profile = row.profile || {};
            var studentProfile = row.studentProfile || {};
            var teacherProfile = row.teacherProfile || {};
            var roleLabel = row.role === "student" ? "学生" : row.role === "teacher" ? "教师" : "教师子账号";
            if (userDialogTitle) userDialogTitle.textContent = isEdit ? "编辑用户" : "用户详情";
            if (userDialogMeta) userDialogMeta.textContent = (profile.realName || "--") + " · " + roleLabel;
            if (userDialogDeleteBtn) userDialogDeleteBtn.hidden = !isEdit;
            if (userDialogCancelBtn) {
                userDialogCancelBtn.hidden = !isEdit;
                userDialogCancelBtn.textContent = "取消";
            }
            if (userDialogSaveBtn) {
                userDialogSaveBtn.hidden = false;
                userDialogSaveBtn.textContent = isEdit ? "保存" : "编辑";
            }

            var baseFields = [
                '<label class="academic-user-dialog-field"><span>姓名</span><input id="academicUserDialogRealName" class="dashboard-input" value="' + escapeHtml(profile.realName || "") + '"' + (isEdit ? "" : " disabled") + ' /></label>',
                '<label class="academic-user-dialog-field"><span>一卡通号</span><input id="academicUserDialogAccountNo" class="dashboard-input" value="' + escapeHtml(profile.accountNo || row.id || "") + '"' + (isEdit ? "" : " disabled") + ' /></label>'
            ];

            if (row.role === "student") {
                userDialogBody.innerHTML = [
                    '<div class="academic-user-dialog-grid">',
                    baseFields.join(""),
                    '<label class="academic-user-dialog-field"><span>年级</span><select id="academicUserDialogGrade" class="dashboard-select"' + (isEdit ? "" : " disabled") + '><option value="' + escapeHtml(String(studentProfile.grade || "")) + '">' + escapeHtml(String(studentProfile.grade || "请选择年级")) + '</option></select></label>',
                    '<label class="academic-user-dialog-field"><span>届次</span><select id="academicUserDialogCohort" class="dashboard-select"' + (isEdit ? "" : " disabled") + '><option value="' + escapeHtml(String(studentProfile.cohort || "")) + '">' + escapeHtml(String(studentProfile.cohort || "请选择届次")) + '</option></select></label>',
                    '<label class="academic-user-dialog-field"><span>专业</span><select id="academicUserDialogMajor" class="dashboard-select"' + (isEdit ? "" : " disabled") + '><option value="' + escapeHtml(studentProfile.major || "") + '">' + escapeHtml(studentProfile.major || "请选择专业") + '</option></select></label>',
                    '<label class="academic-user-dialog-field"><span>行政班</span><select id="academicUserDialogAdminClass" class="dashboard-select"' + (isEdit ? "" : " disabled") + '><option value="' + escapeHtml(studentProfile.adminClass || "") + '">' + escapeHtml(studentProfile.adminClass || "请选择行政班") + '</option></select></label>',
                    '</div>'
                ].join("");
                bindUserDialogStudentTaxonomy();
            } else if (row.role === "teacher") {
                userDialogBody.innerHTML = [
                    '<div class="academic-user-dialog-grid">',
                    baseFields.join(""),
                    '<label class="academic-user-dialog-field"><span>工号</span><input id="academicUserDialogTeacherNo" class="dashboard-input" value="' + escapeHtml(teacherProfile.teacherNo || row.id || "") + '"' + (isEdit ? "" : " disabled") + ' /></label>',
                    '<label class="academic-user-dialog-field"><span>学院</span><input id="academicUserDialogCollege" class="dashboard-input" value="' + escapeHtml(teacherProfile.college || "") + '"' + (isEdit ? "" : " disabled") + ' /></label>',
                    '<label class="academic-user-dialog-field"><span>职称</span><input id="academicUserDialogTitleField" class="dashboard-input" value="' + escapeHtml(teacherProfile.title || "") + '"' + (isEdit ? "" : " disabled") + ' /></label>',
                    '<label class="academic-user-dialog-field academic-user-dialog-field-wide"><span>研究方向</span><textarea id="academicUserDialogResearchDirection" class="dashboard-textarea"' + (isEdit ? "" : " disabled") + '>' + escapeHtml(teacherProfile.researchDirection || "") + '</textarea></label>',
                    '</div>'
                ].join("");
            } else {
                var assistantOwner = Array.isArray(row.teacherAssistantsAsAssistant) ? row.teacherAssistantsAsAssistant[0] : null;
                var ownerName = assistantOwner && assistantOwner.teacher && assistantOwner.teacher.profile ? assistantOwner.teacher.profile.realName || assistantOwner.teacherUserId || "--" : "--";
                userDialogBody.innerHTML = [
                    '<div class="academic-user-dialog-grid">',
                    baseFields.join(""),
                    '<label class="academic-user-dialog-field"><span>所属教师</span><input class="dashboard-input" value="' + escapeHtml(ownerName) + '" disabled /></label>',
                    '<label class="academic-user-dialog-field"><span>已绑课程数</span><input class="dashboard-input" value="' + escapeHtml(String(row._count && row._count.assistantBindingsAsAssistant ? row._count.assistantBindingsAsAssistant : 0)) + '" disabled /></label>',
                    '</div>'
                ].join("");
            }

            userDialog.hidden = false;
        }

        async function saveUserDialog() {
            var row = currentUserDirectoryRow();
            if (!row) {
                notifyUserDirectoryAction("无法保存", "请先选择需要编辑的用户。", true);
                return;
            }
            if (state.userDialogMode !== "edit") {
                renderUserDialog("edit");
                return;
            }
            var realNameInput = document.getElementById("academicUserDialogRealName");
            var accountNoInput = document.getElementById("academicUserDialogAccountNo");
            var payload = {
                realName: realNameInput && realNameInput.value.trim(),
                accountNo: accountNoInput && accountNoInput.value.trim(),
            };
            if (row.role === "student") {
                var gradeInput = document.getElementById("academicUserDialogGrade");
                var cohortInput = document.getElementById("academicUserDialogCohort");
                var majorInput = document.getElementById("academicUserDialogMajor");
                var adminClassInput = document.getElementById("academicUserDialogAdminClass");
                payload.stuNo = payload.accountNo;
                payload.grade = gradeInput && gradeInput.value;
                payload.cohort = cohortInput && cohortInput.value;
                payload.major = majorInput && majorInput.value;
                payload.adminClass = adminClassInput && adminClassInput.value;
            } else if (row.role === "teacher") {
                var teacherNoInput = document.getElementById("academicUserDialogTeacherNo");
                var collegeInput = document.getElementById("academicUserDialogCollege");
                var titleInput = document.getElementById("academicUserDialogTitleField");
                var researchDirectionInput = document.getElementById("academicUserDialogResearchDirection");
                payload.teacherNo = teacherNoInput && teacherNoInput.value.trim();
                payload.college = collegeInput && collegeInput.value.trim();
                payload.title = titleInput && titleInput.value.trim();
                payload.researchDirection = researchDirectionInput && researchDirectionInput.value.trim();
            }
            openUserConfirmDialog("确认保存", "确认保存当前用户修改吗？", async function () {
                try {
                    await window.linkseeApi.patchJson("/api/v1/users/" + encodeURIComponent(String(row.id || "")), payload);
                    notifyUserDirectoryAction("保存成功", "用户资料已更新。", false);
                    closeUserDialog();
                    await Promise.all([refreshUserDirectoryStats(), loadUserDirectory()]);
                } catch (error) {
                    notifyUserDirectoryAction("保存失败", error && error.message ? error.message : "用户资料更新失败。", true);
                }
            });
        }

        function deleteUserFromDialog() {
            var row = currentUserDirectoryRow();
            if (!row) {
                notifyUserDirectoryAction("无法删除", "请先选择需要删除的用户。", true);
                return;
            }
            openUserConfirmDialog("确认删除", "确认删除“" + String((row.profile && row.profile.realName) || row.id || "") + "”吗？", async function () {
                try {
                    await window.linkseeApi.request("/api/v1/users/" + encodeURIComponent(String(row.id || "")), {
                        method: "DELETE",
                        headers: window.linkseeApi.authHeaders(),
                    });
                    closeUserDialog();
                    notifyUserDirectoryAction("删除成功", "用户已删除。", false);
                    await Promise.all([refreshUserDirectoryStats(), loadUserDirectory()]);
                } catch (error) {
                    notifyUserDirectoryAction("删除失败", error && error.message ? error.message : "用户删除失败。", true);
                }
            });
        }

        function renderUserDirectoryPagination() {
            if (!userDirectoryPagination || !userPageButtons) return;
            var totalPages = Math.max(1, Math.ceil((state.userDirectoryTotal || 0) / state.userDirectoryPageSize));
            userDirectoryPagination.hidden = state.userDirectoryTotal <= 0;
            var current = state.userDirectoryPage;
            var buttons = [];
            for (var page = Math.max(1, current - 2); page <= Math.min(totalPages, current + 2); page += 1) {
                buttons.push('<button class="academic-page-btn' + (page === current ? ' is-active' : '') + '" type="button" data-user-page="' + page + '">' + page + '</button>');
            }
            userPageButtons.innerHTML = buttons.join("") || '<span class="academic-page-empty">1</span>';
            if (userPageSize) userPageSize.value = String(state.userDirectoryPageSize);
            if (userPrevPageBtn) userPrevPageBtn.disabled = current <= 1;
            if (userNextPageBtn) userNextPageBtn.disabled = current >= totalPages;
        }

        function renderUserDirectoryTable() {
            if (!userDirectoryTable) return;
            var rows = Array.isArray(state.userDirectoryRows) ? state.userDirectoryRows : [];
            var selectedIds = new Set(selectedUserDirectoryIds());
            var allChecked = rows.length > 0 && rows.every(function (row) { return selectedIds.has(String(row.id || "")); });
            if (state.userDirectoryMode === "student") {
                userDirectoryTable.innerHTML = [
                    '<div class="academic-user-directory-head academic-user-directory-head-student"><span><input type="checkbox" data-user-select-all' + (allChecked ? ' checked' : '') + ' /></span><span>一卡通号</span><span>姓名</span><span>年级</span><span>专业</span><span>行政班</span><span>届次</span><span>操作</span></div>',
                    rows.length
                        ? rows.map(function (row) {
                            var profile = row.profile || {};
                            var studentProfile = row.studentProfile || {};
                            var selected = String(row.id || "") === String(state.selectedUserDirectoryId || "") ? ' is-selected' : '';
                            var checked = selectedIds.has(String(row.id || "")) ? ' checked' : '';
                            return '<div class="academic-user-directory-row academic-user-directory-row-student' + selected + '" data-user-row="' + escapeHtml(String(row.id || "")) + '"><span><input type="checkbox" data-user-select="' + escapeHtml(String(row.id || "")) + '"' + checked + ' /></span><span>' + escapeHtml(profile.accountNo || row.id || "--") + '</span><span>' + escapeHtml(profile.realName || "--") + '</span><span>' + escapeHtml(String(studentProfile.grade || "--")) + '</span><span>' + escapeHtml(studentProfile.major || "--") + '</span><span>' + escapeHtml(studentProfile.adminClass || "--") + '</span><span>' + escapeHtml(String(studentProfile.cohort || "--")) + '</span><span class="academic-user-row-actions"><button class="academic-inline-text-btn academic-user-row-link" type="button" data-user-action="detail" data-user-id="' + escapeHtml(String(row.id || "")) + '">详情</button></span></div>';
                        }).join("")
                        : '<div class="academic-user-directory-empty">暂无结果</div>'
                ].join("");
            } else if (state.userDirectoryMode === "teacher") {
                userDirectoryTable.innerHTML = [
                    '<div class="academic-user-directory-head academic-user-directory-head-teacher"><span><input type="checkbox" data-user-select-all' + (allChecked ? ' checked' : '') + ' /></span><span>工号</span><span>姓名</span><span>学院</span><span>职称</span><span>一卡通号</span><span>操作</span></div>',
                    rows.length
                        ? rows.map(function (row) {
                            var profile = row.profile || {};
                            var teacherProfile = row.teacherProfile || {};
                            var selected = String(row.id || "") === String(state.selectedUserDirectoryId || "") ? ' is-selected' : '';
                            var checked = selectedIds.has(String(row.id || "")) ? ' checked' : '';
                            return '<div class="academic-user-directory-row academic-user-directory-row-teacher' + selected + '" data-user-row="' + escapeHtml(String(row.id || "")) + '"><span><input type="checkbox" data-user-select="' + escapeHtml(String(row.id || "")) + '"' + checked + ' /></span><span>' + escapeHtml(teacherProfile.teacherNo || row.id || "--") + '</span><span>' + escapeHtml(profile.realName || "--") + '</span><span>' + escapeHtml(teacherProfile.college || "--") + '</span><span>' + escapeHtml(teacherProfile.title || "--") + '</span><span>' + escapeHtml(profile.accountNo || row.id || "--") + '</span><span class="academic-user-row-actions"><button class="academic-inline-text-btn academic-user-row-link" type="button" data-user-action="detail" data-user-id="' + escapeHtml(String(row.id || "")) + '">详情</button></span></div>';
                        }).join("")
                        : '<div class="academic-user-directory-empty">暂无结果</div>'
                ].join("");
            } else {
                userDirectoryTable.innerHTML = [
                    '<div class="academic-user-directory-head academic-user-directory-head-assistant"><span><input type="checkbox" data-user-select-all' + (allChecked ? ' checked' : '') + ' /></span><span>助教账号</span><span>姓名</span><span>所属教师</span><span>已绑课程</span><span>操作</span></div>',
                    rows.length
                        ? rows.map(function (row) {
                            var profile = row.profile || {};
                            var ownerBinding = Array.isArray(row.teacherAssistantsAsAssistant) ? row.teacherAssistantsAsAssistant[0] : null;
                            var ownerName = ownerBinding && ownerBinding.teacher && ownerBinding.teacher.profile ? ownerBinding.teacher.profile.realName || ownerBinding.teacherUserId || "--" : "--";
                            var selected = String(row.id || "") === String(state.selectedUserDirectoryId || "") ? ' is-selected' : '';
                            var checked = selectedIds.has(String(row.id || "")) ? ' checked' : '';
                            return '<div class="academic-user-directory-row academic-user-directory-row-assistant' + selected + '" data-user-row="' + escapeHtml(String(row.id || "")) + '"><span><input type="checkbox" data-user-select="' + escapeHtml(String(row.id || "")) + '"' + checked + ' /></span><span>' + escapeHtml(profile.accountNo || row.id || "--") + '</span><span>' + escapeHtml(profile.realName || "--") + '</span><span>' + escapeHtml(ownerName) + '</span><span>' + escapeHtml(String(row._count && row._count.assistantBindingsAsAssistant ? row._count.assistantBindingsAsAssistant : 0)) + '</span><span class="academic-user-row-actions"><button class="academic-inline-text-btn academic-user-row-link" type="button" data-user-action="detail" data-user-id="' + escapeHtml(String(row.id || "")) + '">详情</button></span></div>';
                        }).join("")
                        : '<div class="academic-user-directory-empty">暂无结果</div>'
                ].join("");
            }
            if (userDirectoryMeta) {
                userDirectoryMeta.innerHTML = '<span>共 ' + state.userDirectoryTotal + ' 条</span><span>已选择 ' + selectedIds.size + ' 条</span>';
            }
            syncUserDirectoryActionButtons();
            renderUserDirectoryPagination();
        }

        async function loadUserDirectory() {
            if (!userDirectoryTable) return;
            var filters = currentUserDirectoryFilters();
            var payload = await searchDirectory({
                role: filters.role,
                keyword: filters.keyword,
                realName: filters.realName,
                accountNo: filters.accountNo,
                grade: filters.grade,
                major: filters.major,
                adminClass: filters.adminClass,
                teacherNo: filters.teacherNo,
                college: filters.college,
                title: filters.title,
                ownerTeacherName: filters.ownerTeacherName,
                cohort: filters.cohort,
                page: state.userDirectoryPage,
                limit: state.userDirectoryPageSize,
            });
            state.userDirectoryRows = Array.isArray(payload.data) ? payload.data : [];
            state.userDirectoryTotal = payload.paging && payload.paging.total ? Number(payload.paging.total) : state.userDirectoryRows.length;
            setUserDirectorySelectedIds(selectedUserDirectoryIds().filter(function (id) {
                return state.userDirectoryRows.some(function (row) { return String(row.id || "") === String(id); });
            }));
            if (state.userDirectoryRows.some(function (row) { return String(row.id || "") === String(state.selectedUserDirectoryId || ""); })) {
                state.selectedUserDirectoryId = String(state.selectedUserDirectoryId || "");
            } else {
                state.selectedUserDirectoryId = state.userDirectoryRows[0] && state.userDirectoryRows[0].id ? String(state.userDirectoryRows[0].id) : "";
            }
            renderUserDirectorySummary();
            renderUserDirectoryTable();
        }

        async function refreshUserDirectoryStats() {
            if (!userSummaryMeta) return;
            var results = await Promise.all([
                searchDirectory({ role: "student", page: 1, limit: 1 }).catch(function () { return { paging: { total: 0 } }; }),
                searchDirectory({ role: "teacher", page: 1, limit: 1 }).catch(function () { return { paging: { total: 0 } }; }),
                searchDirectory({ role: "assistant", page: 1, limit: 1 }).catch(function () { return { paging: { total: 0 } }; }),
            ]);
            state.userDirectoryStats.student = results[0].paging && results[0].paging.total ? Number(results[0].paging.total) : 0;
            state.userDirectoryStats.teacher = results[1].paging && results[1].paging.total ? Number(results[1].paging.total) : 0;
            state.userDirectoryStats.assistant = results[2].paging && results[2].paging.total ? Number(results[2].paging.total) : 0;
            renderUserDirectorySummary();
        }

        function syncCourseSelectors() {
            var options = state.courses.map(function (course) {
                return '<option value="' + escapeHtml(String(course.id || "")) + '">' + escapeHtml(String(course.name || course.courseNo || course.id || "--")) + "</option>";
            }).join("");

            if (editCourseSelect) {
                editCourseSelect.innerHTML = options || '<option value="">暂无课程</option>';
                if (!state.selectedEditCourseId && state.courses[0]) {
                    state.selectedEditCourseId = String(state.courses[0].id || "");
                }
                if (state.selectedEditCourseId) {
                    editCourseSelect.value = state.selectedEditCourseId;
                }
            }
            syncEditCourseForm();
        }

        function syncEditCourseForm() {
            if (!editCourseSelect) return;

            var selectedId = state.selectedEditCourseId || editCourseSelect.value || "";
            var course = state.courses.find(function (item) {
                return String(item.id) === String(selectedId);
            }) || null;

            if (course) {
                state.selectedEditCourseId = String(course.id || "");
                editCourseSelect.value = state.selectedEditCourseId;
            }

            if (!course) {
                if (editCourseHint) editCourseHint.textContent = "";
                if (editCourseMeta) editCourseMeta.innerHTML = "<span>等待选择课程</span>";
                if (editCourseNo) editCourseNo.value = "";
                if (editCourseName) editCourseName.value = "";
                if (editCourseDescription) editCourseDescription.value = "";
                if (editCourseStatus) editCourseStatus.value = "draft";
                if (openMemberPickerBtn) {
                    openMemberPickerBtn.disabled = true;
                    openMemberPickerBtn.textContent = "修改成员";
                }
                if (courseStudentDetailBtn) courseStudentDetailBtn.hidden = false;
                return;
            }

            if (editCourseHint) editCourseHint.textContent = "";
            if (editCourseMeta) {
                editCourseMeta.innerHTML = [
                    '<span class="dashboard-filter-tag">编号 ' + escapeHtml(String(course.courseNo || course.id || "--")) + "</span>",
                    '<span class="dashboard-filter-tag">' + escapeHtml(String(course.academicYear || "--")) + " 学年</span>",
                    '<span class="dashboard-filter-tag">第 ' + escapeHtml(String(course.semester || "--")) + " 学期</span>",
                    '<span class="dashboard-filter-tag">' + escapeHtml(getStatusLabel(String(course.status || "draft"))) + "</span>",
                ].join("");
            }
            if (editCourseNo) editCourseNo.value = String(course.courseNo || course.id || "");
            if (editCourseName) editCourseName.value = String(course.name || "");
            if (editCourseDescription) editCourseDescription.value = String(course.description || "");
            if (editCourseStatus) editCourseStatus.value = String(course.status || "draft");
            if (openMemberPickerBtn) {
                openMemberPickerBtn.disabled = false;
                openMemberPickerBtn.textContent = course.status === "archived" ? "课程已封存" : "修改成员";
                openMemberPickerBtn.disabled = course.status === "archived";
            }
            if (courseStudentDetailBtn) courseStudentDetailBtn.hidden = false;
        }

        function showResult(container, title, message, isError) {
            if (typeof window.linkseeDashboardToast === "function") {
                hideResult(container);
                window.linkseeDashboardToast(title, message, isError);
                return;
            }
            if (!container) return;
            container.hidden = false;
            container.innerHTML = "<strong>" + escapeHtml(title) + "</strong><p>" + escapeHtml(message) + "</p>";
            container.style.borderColor = isError ? "rgba(220, 38, 38, 0.3)" : "";
        }

        function showImportHintToast() {
            if (typeof window.linkseeDashboardToast !== "function") return;
            window.linkseeDashboardToast(
                "导入要求",
                "支持 .xlsx / .xls / .csv；表格需包含“姓名”和“一卡通号”两列，系统会自动匹配并勾选可加入学生。",
                false
            );
        }

        function hideResult(container) {
            if (!container) return;
            container.hidden = true;
            container.innerHTML = "";
            container.style.borderColor = "";
        }

        function showBatchResult(payload, typeLabel) {
            var data = payload && payload.data ? payload.data : {};
            var failed = Array.isArray(data.failed) ? data.failed : [];
            if (typeof window.linkseeDashboardToast === "function") {
                window.linkseeDashboardToast(
                    typeLabel + "批量开通完成",
                    "成功创建 " + String(data.createdCount || 0) + " 条，失败 " + String(data.failedCount || 0) + " 条。",
                    Boolean(failed.length)
                );
                return;
            }
            if (!batchResult) return;
            batchResult.hidden = false;
            batchResult.innerHTML = [
                "<strong>" + escapeHtml(typeLabel + "批量开通完成") + "</strong>",
                "<p>成功创建 " + escapeHtml(String(data.createdCount || 0)) + " 条，失败 " + escapeHtml(String(data.failedCount || 0)) + " 条，默认密码：" + escapeHtml(String(data.defaultPassword || "后端未返回")) + "</p>",
                failed.length ? "<p>失败明细：" + escapeHtml(failed.map(function (item) { return (item.id || "--") + " - " + (item.reason || "unknown"); }).join("；")) + "</p>" : "",
            ].join("");
        }

        function renderCourseRelationLists() {
            var teacherCountValue = (state.selectedEditCourseTeachers || []).length + (state.selectedEditCourseAssistants || []).length;
            var studentCountValue = (state.selectedEditCourseMembers || []).length;
            var staffRows = [];

            if (courseTeacherCount) {
                courseTeacherCount.textContent = "教师 / 助教 " + String(teacherCountValue);
            }
            if (courseStudentCount) {
                courseStudentCount.textContent = "学生 " + String(studentCountValue);
            }

            (state.selectedEditCourseTeachers || []).forEach(function (teacher) {
                var userId = teacher.user && teacher.user.id ? teacher.user.id : "--";
                var name = teacher.user && teacher.user.profile && teacher.user.profile.realName ? teacher.user.profile.realName : "--";
                var avatarUrl = teacher.user && teacher.user.profile && teacher.user.profile.avatarUrl ? teacher.user.profile.avatarUrl : "";
                var college = teacher.user && teacher.user.teacherProfile && teacher.user.teacherProfile.college ? teacher.user.teacherProfile.college : "未填写学院";
                staffRows.push({
                    userId: userId,
                    name: name,
                    avatarUrl: avatarUrl,
                    college: college,
                    roleLabel: teacher.role === "lead" ? "主讲教师" : "协同教师",
                    removable: true,
                    variant: "",
                });
            });

            (state.selectedEditCourseAssistants || []).forEach(function (assistant) {
                var name = assistant.assistant && assistant.assistant.profile && assistant.assistant.profile.realName ? assistant.assistant.profile.realName : "--";
                var userId = assistant.assistant && assistant.assistant.id ? assistant.assistant.id : "--";
                var avatarUrl = assistant.assistant && assistant.assistant.profile && assistant.assistant.profile.avatarUrl ? assistant.assistant.profile.avatarUrl : "";
                staffRows.push({
                    userId: userId,
                    name: name,
                    avatarUrl: avatarUrl,
                    college: "课程助教",
                    roleLabel: "助教",
                    removable: false,
                    variant: "is-assistant",
                });
            });

            if (courseRelationTeachers) {
                courseRelationTeachers.innerHTML = staffRows.length
                    ? '<div class="academic-member-table-shell academic-member-table-shell-staff"><div class="academic-member-table-head academic-member-table-head-staff"><span>姓名</span><span>身份</span><span>学院 / 说明</span><span>操作</span></div><div class="academic-member-table-body">' + staffRows.map(function (row) {
                        return '<div class="academic-member-table-row academic-member-table-row-staff"><div class="academic-member-table-person">' + renderAvatar(row.avatarUrl, row.name, row.variant) + '<div class="academic-member-table-copy"><strong>' + escapeHtml(row.name) + '</strong><span>一卡通号 ' + escapeHtml(row.userId) + '</span></div></div><span class="academic-member-table-role academic-member-table-role-text">' + escapeHtml(row.roleLabel) + '</span><span title="' + escapeHtml(row.college) + '">' + escapeHtml(row.college) + '</span><div class="academic-member-table-action">' + (row.removable ? '<button class="btn btn-secondary academic-staff-btn" type="button" data-course-quick-teacher-remove="' + escapeHtml(row.userId) + '">移除</button>' : '<span class="academic-member-table-action-placeholder">-</span>') + '</div></div>';
                    }).join("") + '</div></div>'
                    : '<div class="academic-member-table-shell academic-member-table-shell-staff"><div class="academic-member-table-head academic-member-table-head-staff"><span>姓名</span><span>身份</span><span>学院 / 说明</span><span>操作</span></div><div class="academic-member-table-body"><div class="academic-member-empty">暂无教职工信息</div></div></div>';
            }

            if (courseRelationAssistants) {
                courseRelationAssistants.innerHTML = "";
            }

            if (courseRelationMembers) {
                var hasMembers = state.selectedEditCourseMembers.length > 0;
                courseRelationMembers.innerHTML = [
                    '<div class="academic-member-table-shell academic-member-table-shell-student">',
                    '<div class="academic-member-table-head academic-member-table-head-student"><span>姓名</span><span>学院 / 专业</span><span>行政班</span></div>',
                    '<div class="academic-member-table-body">',
                    hasMembers
                        ? state.selectedEditCourseMembers.map(function (member) {
                            var user = member.user || {};
                            var profile = user.profile || {};
                            var studentProfile = user.studentProfile || {};
                            var name = profile.realName || "--";
                            var college = studentProfile.college || "--";
                            var major = studentProfile.major || "--";
                            var adminClass = studentProfile.adminClass || "--";
                            return '<div class="academic-member-table-row academic-member-table-row-student"><span title="' + escapeHtml(name) + '">' + escapeHtml(name) + '</span><span title="' + escapeHtml(college + " / " + major) + '">' + escapeHtml(college + " / " + major) + '</span><span title="' + escapeHtml(adminClass) + '">' + escapeHtml(adminClass) + '</span></div>';
                        }).join("")
                        : '<div class="academic-member-empty">暂无信息</div>',
                    '</div></div>'
                ].join("");
            }
        }

        async function refreshCourseRelationData() {
            var selectedId = state.selectedEditCourseId || editCourseSelect && editCourseSelect.value;
            if (!selectedId) {
                state.selectedEditCourseTeachers = [];
                state.selectedEditCourseAssistants = [];
                state.selectedEditCourseMembers = [];
                renderCourseRelationLists();
                return;
            }

            var results = await Promise.all([
                window.linkseeApi.getJson("/api/v1/courses/" + encodeURIComponent(selectedId) + "/teachers").catch(function () { return { data: [] }; }),
                window.linkseeApi.getJson("/api/v1/courses/" + encodeURIComponent(selectedId) + "/assistants").catch(function () { return { data: [] }; }),
                window.linkseeApi.getJson("/api/v1/courses/" + encodeURIComponent(selectedId) + "/members?limit=100").catch(function () { return { data: [] }; }),
            ]);
            state.selectedEditCourseTeachers = Array.isArray(results[0].data) ? results[0].data : [];
            state.selectedEditCourseAssistants = Array.isArray(results[1].data) ? results[1].data : [];
            state.selectedEditCourseMembers = Array.isArray(results[2].data) ? results[2].data : [];
            renderCourseRelationLists();
        }

        async function loadAllAcademicCourses() {
            var offset = 0;
            var limit = 100;
            var rows = [];
            var hasMore = true;

            while (hasMore) {
                var payload = await window.linkseeApi.getJson("/api/v1/courses?limit=" + limit + "&offset=" + offset);
                var batch = Array.isArray(payload.data) ? payload.data : [];
                rows = rows.concat(batch);
                hasMore = Boolean(payload.paging && payload.paging.hasMore);
                offset += batch.length;
                if (!batch.length) {
                    hasMore = false;
                }
            }

            return rows;
        }

        async function refreshAcademicData() {
            state.courses = await loadAllAcademicCourses();
            syncCourseFilterOptions();
            renderCourses();
            syncUserDirectoryTabs();
            await Promise.all([refreshUserDirectoryStats(), loadUserDirectory()]);
            await refreshCourseRelationData();
        }

        syncUserDirectoryActionButtons();

        Promise.resolve()
            .then(refreshAcademicData)
            .catch(function () {
                if (empty) {
                    empty.hidden = false;
                    empty.querySelector("strong").textContent = "课程加载失败";
                    empty.querySelector("p").textContent = "请检查后端服务是否启动。";
                }
            });

        window.addEventListener("linksee:academic-refresh-request", function (event) {
            if (event && event.detail && event.detail.courseId) {
                state.selectedEditCourseId = String(event.detail.courseId);
            }
            if (event && event.detail && event.detail.reason === "course-created") {
                state.coursePage = 1;
                if (courseSearch) courseSearch.value = "";
                if (courseTeacherFilter) courseTeacherFilter.value = "";
                if (courseYearFilter) courseYearFilter.value = "";
                if (courseSemesterFilter) courseSemesterFilter.value = "";
                if (courseStatusFilter) courseStatusFilter.value = "全部状态";
            }
            refreshAcademicData().catch(function () {});
        });

        if (courseSearch) courseSearch.addEventListener("input", function () {
            state.coursePage = 1;
            renderCourses();
        });
        if (courseTeacherFilter) courseTeacherFilter.addEventListener("input", function () {
            state.coursePage = 1;
            renderCourses();
        });
        if (courseYearFilter) courseYearFilter.addEventListener("change", function () {
            state.coursePage = 1;
            renderCourses();
        });
        if (courseSemesterFilter) courseSemesterFilter.addEventListener("change", function () {
            state.coursePage = 1;
            renderCourses();
        });
        if (courseStatusFilter) courseStatusFilter.addEventListener("change", function () {
            state.coursePage = 1;
            renderCourses();
        });
        if (userTabStudent) {
            userTabStudent.addEventListener("click", function () {
                state.userDirectoryMode = "student";
                state.userDirectoryPage = 1;
                syncUserDirectoryTabs();
                loadUserDirectory().catch(function () {});
            });
        }
        if (userTabTeacher) {
            userTabTeacher.addEventListener("click", function () {
                state.userDirectoryMode = "teacher";
                state.userDirectoryPage = 1;
                setUserDirectorySelectedIds([]);
                syncUserDirectoryTabs();
                loadUserDirectory().catch(function () {});
            });
        }
        if (userTabAssistant) {
            userTabAssistant.addEventListener("click", function () {
                state.userDirectoryMode = "assistant";
                state.userDirectoryPage = 1;
                setUserDirectorySelectedIds([]);
                syncUserDirectoryTabs();
                loadUserDirectory().catch(function () {});
            });
        }
        if (userStudentSearchBtn) {
            userStudentSearchBtn.addEventListener("click", function () {
                state.userDirectoryMode = "student";
                state.userDirectoryPage = 1;
                setUserDirectorySelectedIds([]);
                syncUserDirectoryTabs();
                loadUserDirectory().catch(function () {});
            });
        }
        if (userStudentResetBtn) {
            userStudentResetBtn.addEventListener("click", function () {
                if (userStudentKeyword) userStudentKeyword.value = "";
                if (userStudentGrade) userStudentGrade.value = "";
                if (userStudentMajor) userStudentMajor.value = "";
                if (userStudentCohort) userStudentCohort.value = "";
                syncStudentAdminClassSelect(userStudentAdminClass, "", "", "", "全部行政班");
                state.userDirectoryMode = "student";
                state.userDirectoryPage = 1;
                setUserDirectorySelectedIds([]);
                syncUserDirectoryTabs();
                loadUserDirectory().catch(function () {});
            });
        }
        if (userTeacherSearchBtn) {
            userTeacherSearchBtn.addEventListener("click", function () {
                state.userDirectoryMode = "teacher";
                state.userDirectoryPage = 1;
                setUserDirectorySelectedIds([]);
                syncUserDirectoryTabs();
                loadUserDirectory().catch(function () {});
            });
        }
        if (userTeacherResetBtn) {
            userTeacherResetBtn.addEventListener("click", function () {
                if (userTeacherKeyword) userTeacherKeyword.value = "";
                if (userTeacherCollege) userTeacherCollege.value = "";
                if (userTeacherTitle) userTeacherTitle.value = "";
                state.userDirectoryMode = "teacher";
                state.userDirectoryPage = 1;
                setUserDirectorySelectedIds([]);
                syncUserDirectoryTabs();
                loadUserDirectory().catch(function () {});
            });
        }
        if (userAssistantSearchBtn) {
            userAssistantSearchBtn.addEventListener("click", function () {
                state.userDirectoryMode = "assistant";
                state.userDirectoryPage = 1;
                setUserDirectorySelectedIds([]);
                syncUserDirectoryTabs();
                loadUserDirectory().catch(function () {});
            });
        }
        if (userAssistantResetBtn) {
            userAssistantResetBtn.addEventListener("click", function () {
                if (userAssistantKeyword) userAssistantKeyword.value = "";
                if (userAssistantOwner) userAssistantOwner.value = "";
                state.userDirectoryMode = "assistant";
                state.userDirectoryPage = 1;
                setUserDirectorySelectedIds([]);
                syncUserDirectoryTabs();
                loadUserDirectory().catch(function () {});
            });
        }
        if (userPrevPageBtn) {
            userPrevPageBtn.addEventListener("click", function () {
                state.userDirectoryPage = Math.max(1, state.userDirectoryPage - 1);
                loadUserDirectory().catch(function () {});
            });
        }
        if (userNextPageBtn) {
            userNextPageBtn.addEventListener("click", function () {
                state.userDirectoryPage += 1;
                loadUserDirectory().catch(function () {});
            });
        }
        if (userPageButtons) {
            userPageButtons.addEventListener("click", function (event) {
                var trigger = event.target && event.target.closest ? event.target.closest("[data-user-page]") : null;
                if (!trigger) return;
                state.userDirectoryPage = Number(trigger.getAttribute("data-user-page") || "1") || 1;
                loadUserDirectory().catch(function () {});
            });
        }
        if (userDirectoryTable) {
            userDirectoryTable.addEventListener("click", function (event) {
                var selectAllTrigger = event.target && event.target.closest ? event.target.closest("[data-user-select-all]") : null;
                if (selectAllTrigger) {
                    toggleUserSelectionAll(Boolean(selectAllTrigger.checked));
                    return;
                }
                var selectTrigger = event.target && event.target.closest ? event.target.closest("[data-user-select]") : null;
                if (selectTrigger) {
                    var checkboxId = selectTrigger.getAttribute("data-user-select") || "";
                    toggleUserSelection(checkboxId, Boolean(selectTrigger.checked));
                    return;
                }
                var actionTrigger = event.target && event.target.closest ? event.target.closest("[data-user-action]") : null;
                if (actionTrigger) {
                    state.selectedUserDirectoryId = actionTrigger.getAttribute("data-user-id") || "";
                    renderUserDirectoryTable();
                    renderUserDialog("detail");
                    return;
                }
                var trigger = event.target && event.target.closest ? event.target.closest("[data-user-row]") : null;
                if (!trigger) return;
                state.selectedUserDirectoryId = trigger.getAttribute("data-user-row") || "";
                renderUserDirectoryTable();
            });
        }
        if (userExportBtn) {
            userExportBtn.addEventListener("click", function (event) {
                event.stopPropagation();
                toggleFloatMenu(userExportMenu, userExportBtn);
            });
        }
        if (userImportBtn) {
            userImportBtn.addEventListener("click", function (event) {
                event.stopPropagation();
                toggleFloatMenu(userImportMenu, userImportBtn);
            });
        }
        if (userExportMenu) {
            userExportMenu.addEventListener("click", function (event) {
                var trigger = event.target && event.target.closest ? event.target.closest("[data-user-export-format]") : null;
                if (!trigger) return;
                closeUserFloatMenus();
                exportUserDirectory(trigger.getAttribute("data-user-export-format") || "xlsx").catch(function () {});
            });
        }
        if (userImportStudentBtn) {
            userImportStudentBtn.addEventListener("click", function () {
                openUserBatchDialog("student");
            });
        }
        if (userImportTeacherBtn) {
            userImportTeacherBtn.addEventListener("click", function () {
                openUserBatchDialog("teacher");
            });
        }
        if (userCreateBtn) {
            userCreateBtn.addEventListener("click", function () {
                openUserCreateDialog();
            });
        }
        if (userDefaultPasswordBtn) {
            userDefaultPasswordBtn.addEventListener("click", function () {
                openUserPasswordDialog();
            });
        }
        if (userResetBtn) {
            userResetBtn.addEventListener("click", function () {
                batchResetSelectedUsers().catch(function () {});
            });
        }
        if (userDialog) {
            userDialog.addEventListener("click", function (event) {
                var trigger = event.target && event.target.closest ? event.target.closest("[data-user-dialog-close]") : null;
                if (!trigger) return;
                closeUserDialog();
            });
        }
        if (userDialogCloseBtn) {
            userDialogCloseBtn.addEventListener("click", function () {
                closeUserDialog();
            });
        }
        if (userDialogCancelBtn) {
            userDialogCancelBtn.addEventListener("click", function () {
                closeUserDialog();
            });
        }
        if (userDialogDeleteBtn) {
            userDialogDeleteBtn.addEventListener("click", function () {
                deleteUserFromDialog();
            });
        }
        if (userDialogSaveBtn) {
            userDialogSaveBtn.addEventListener("click", function () {
                saveUserDialog().catch(function () {});
            });
        }
        if (userBatchDialog) {
            userBatchDialog.addEventListener("click", function (event) {
                var trigger = event.target && event.target.closest ? event.target.closest("[data-user-batch-close]") : null;
                if (!trigger) return;
                closeUserBatchDialog();
            });
        }
        if (userBatchDialogCloseBtn) {
            userBatchDialogCloseBtn.addEventListener("click", function () {
                closeUserBatchDialog();
            });
        }
        if (userImportChooseBtn) {
            userImportChooseBtn.addEventListener("click", function () {
                if (userImportInput) userImportInput.click();
            });
        }
        if (userImportInput) {
            userImportInput.addEventListener("change", function () {
                var file = userImportInput.files && userImportInput.files[0];
                state.userBatchSelectedFile = file || null;
                if (userImportFileName) {
                    userImportFileName.textContent = file ? file.name : "尚未选择文件";
                }
            });
        }
        if (userBatchDialogCancelBtn) {
            userBatchDialogCancelBtn.addEventListener("click", function () {
                closeUserBatchDialog();
            });
        }
        if (userBatchDialogSubmitBtn) {
            userBatchDialogSubmitBtn.addEventListener("click", function () {
                submitUserBatchDialog().catch(function () {});
            });
        }
        if (userPasswordDialog) {
            userPasswordDialog.addEventListener("click", function (event) {
                var trigger = event.target && event.target.closest ? event.target.closest("[data-user-password-close]") : null;
                if (!trigger) return;
                closeUserPasswordDialog();
            });
        }
        if (userPasswordDialogCloseBtn) {
            userPasswordDialogCloseBtn.addEventListener("click", function () {
                closeUserPasswordDialog();
            });
        }
        if (userPasswordDialogClearBtn) {
            userPasswordDialogClearBtn.addEventListener("click", function () {
                if (userDefaultPasswordInput) {
                    userDefaultPasswordInput.value = "";
                }
            });
        }
        if (userPasswordDialogSaveBtn) {
            userPasswordDialogSaveBtn.addEventListener("click", function () {
                var nextPassword = userDefaultPasswordInput ? userDefaultPasswordInput.value.trim() : "";
                persistUserDefaultPassword(nextPassword);
                closeUserPasswordDialog();
                notifyUserDirectoryAction(
                    nextPassword ? "默认密码已保存" : "默认密码已清空",
                    nextPassword ? "后续批量重置和批量导入会优先使用该密码。" : "后续批量操作将改为由后端自动生成密码。",
                    false
                );
            });
        }
        if (userCreateDialog) {
            userCreateDialog.addEventListener("click", function (event) {
                var trigger = event.target && event.target.closest ? event.target.closest("[data-user-create-close]") : null;
                if (!trigger) return;
                closeUserCreateDialog();
            });
        }
        if (userCreateDialogCloseBtn) {
            userCreateDialogCloseBtn.addEventListener("click", function () {
                closeUserCreateDialog();
            });
        }
        if (userCreateDialogCancelBtn) {
            userCreateDialogCancelBtn.addEventListener("click", function () {
                closeUserCreateDialog();
            });
        }
        if (userCreateDialogSubmitBtn) {
            userCreateDialogSubmitBtn.addEventListener("click", function () {
                submitUserCreateDialog().catch(function () {});
            });
        }
        if (userConfirmDialog) {
            userConfirmDialog.addEventListener("click", function (event) {
                var trigger = event.target && event.target.closest ? event.target.closest("[data-user-confirm-close]") : null;
                if (!trigger) return;
                closeUserConfirmDialog();
            });
        }
        if (userConfirmCancelBtn) {
            userConfirmCancelBtn.addEventListener("click", function () {
                closeUserConfirmDialog();
            });
        }
        if (userConfirmSubmitBtn) {
            userConfirmSubmitBtn.addEventListener("click", function () {
                var action = state.userConfirmAction;
                closeUserConfirmDialog();
                if (typeof action === "function") {
                    Promise.resolve(action()).catch(function () {});
                }
            });
        }
        document.addEventListener("click", function (event) {
            var insideImport = event.target && event.target.closest ? event.target.closest(".academic-user-icon-menu") : null;
            if (!insideImport) closeUserFloatMenus();
        });
        if (userPageSize) {
            userPageSize.addEventListener("change", function () {
                state.userDirectoryPageSize = Number(userPageSize.value || "10") || 10;
                state.userDirectoryPage = 1;
                loadUserDirectory().catch(function () {});
            });
        }
        if (userPageJumpBtn) {
            userPageJumpBtn.addEventListener("click", function () {
                var totalPages = Math.max(1, Math.ceil((state.userDirectoryTotal || 0) / state.userDirectoryPageSize));
                var targetPage = Math.max(1, Math.min(totalPages, Number(userPageJumpInput && userPageJumpInput.value || "1") || 1));
                state.userDirectoryPage = targetPage;
                loadUserDirectory().catch(function () {});
            });
        }
        if (coursePrevPageBtn) {
            coursePrevPageBtn.addEventListener("click", function () {
                state.coursePage = Math.max(1, state.coursePage - 1);
                renderCourses();
            });
        }
        if (courseNextPageBtn) {
            courseNextPageBtn.addEventListener("click", function () {
                state.coursePage += 1;
                renderCourses();
            });
        }
        if (coursePageButtons) {
            coursePageButtons.addEventListener("click", function (event) {
                var trigger = event.target && event.target.closest ? event.target.closest("[data-course-page]") : null;
                if (!trigger) return;
                state.coursePage = Number(trigger.getAttribute("data-course-page") || "1") || 1;
                renderCourses();
            });
        }
        if (list && list.dataset.boundCourseEdit !== "1") {
            list.dataset.boundCourseEdit = "1";
            list.addEventListener("click", function (event) {
                var trigger = event.target && event.target.closest ? event.target.closest("[data-course-edit]") : null;
                if (!trigger) return;
                state.selectedEditCourseId = trigger.getAttribute("data-course-edit") || "";
                syncEditCourseForm();
                refreshCourseRelationData().catch(function (err) {
                    showResult(courseRelationResult, "加载失败", err.message || "课程成员数据加载失败。", true);
                });
                scrollEditorIntoView();
            });
        }

        if (editCourseSelect) {
            editCourseSelect.addEventListener("change", function () {
                state.selectedEditCourseId = editCourseSelect.value || "";
                hideResult(editResult);
                hideResult(courseRelationResult);
                syncEditCourseForm();
                refreshCourseRelationData().catch(function (err) {
                    showResult(courseRelationResult, "加载失败", err.message || "课程成员数据加载失败。", true);
                });
            });
        }

        if (editResetBtn) {
            editResetBtn.addEventListener("click", function () {
                hideResult(editResult);
                syncEditCourseForm();
            });
        }

        if (editSubmitBtn) {
            editSubmitBtn.addEventListener("click", function () {
                var selectedId = state.selectedEditCourseId || editCourseSelect && editCourseSelect.value;
                if (!selectedId) {
                    showResult(editResult, "无法保存", "请先选择课程。", true);
                    return;
                }

                hideResult(editResult);
                window.linkseeApi.patchJson("/api/v1/courses/" + encodeURIComponent(selectedId), {
                    name: editCourseName ? editCourseName.value.trim() : "",
                    description: editCourseDescription ? editCourseDescription.value.trim() : "",
                    status: editCourseStatus ? editCourseStatus.value : "draft",
                }).then(function () {
                    showResult(editResult, "保存成功", "课程信息已更新。", false);
                    return refreshAcademicData();
                }).catch(function (err) {
                    showResult(editResult, "保存失败", err.message || "课程更新失败。", true);
                });
            });
        }

        if (openMemberPickerBtn) {
            openMemberPickerBtn.addEventListener("click", function () {
                var selectedCourse = getSelectedEditCourse();
                if (!selectedCourse) {
                    showResult(courseRelationResult, "无法添加", "请先选择课程。", true);
                    return;
                }
                if (selectedCourse.status === "archived") {
                    showResult(courseRelationResult, "无法修改", "已存档课程不可再调整成员。", true);
                    return;
                }
                hideResult(courseRelationResult);
                openMemberPicker("student");
            });
        }

        if (courseStudentDetailBtn) {
            courseStudentDetailBtn.addEventListener("click", function () {
                var selectedCourse = getSelectedEditCourse();
                if (!selectedCourse) {
                    showResult(courseRelationResult, "无法查看", "请先选择课程。", true);
                    return;
                }
                if (memberStudentName) memberStudentName.value = "";
                if (memberStudentStuNo) memberStudentStuNo.value = "";
                if (memberStudentGrade) memberStudentGrade.value = "";
                if (memberStudentMajor) memberStudentMajor.value = "";
                syncStudentAdminClassSelect(memberStudentAdminClass, "", "", "", "全部行政班");
                if (memberStudentAddedOnly) memberStudentAddedOnly.checked = true;
                hideResult(courseRelationResult);
                state.memberPickerMode = "student";
                state.memberPickerPage = 1;
                state.memberPickerImportedMode = false;
                syncMemberPickerTabs();
                showAcademicModal(memberPicker);
                loadMemberDirectory().catch(function (err) {
                    showResult(courseRelationResult, "加载失败", err.message || "学生目录加载失败。", true);
                });
            });
        }

        if (memberPickerCloseBtn) {
            memberPickerCloseBtn.addEventListener("click", closeMemberPicker);
        }

        Array.from(document.querySelectorAll("[data-member-picker-close]")).forEach(function (node) {
            node.addEventListener("click", closeMemberPicker);
        });

        if (memberTabStudent) {
            memberTabStudent.addEventListener("click", function () {
                state.memberPickerMode = "student";
                state.memberPickerPage = 1;
                syncMemberPickerTabs();
                loadMemberDirectory().catch(function (err) {
                    showResult(courseRelationResult, "加载失败", err.message || "学生目录加载失败。", true);
                });
            });
        }

        if (memberTabTeacher) {
            memberTabTeacher.addEventListener("click", function () {
                state.memberPickerMode = "teacher";
                state.memberPickerPage = 1;
                syncMemberPickerTabs();
                loadMemberDirectory().catch(function (err) {
                    showResult(courseRelationResult, "加载失败", err.message || "教师目录加载失败。", true);
                });
            });
        }

        if (memberStudentSearchBtn) {
            memberStudentSearchBtn.addEventListener("click", function () {
                state.memberPickerMode = "student";
                state.memberPickerPage = 1;
                state.memberPickerImportedMode = false;
                loadMemberDirectory().catch(function (err) {
                    showResult(courseRelationResult, "查询失败", err.message || "学生查询失败。", true);
                });
            });
        }

        if (memberTeacherSearchBtn) {
            memberTeacherSearchBtn.addEventListener("click", function () {
                state.memberPickerMode = "teacher";
                state.memberPickerPage = 1;
                loadMemberDirectory().catch(function (err) {
                    showResult(courseRelationResult, "查询失败", err.message || "教师查询失败。", true);
                });
            });
        }

        if (memberStudentResetBtn) {
            memberStudentResetBtn.addEventListener("click", function () {
                if (memberStudentName) memberStudentName.value = "";
                if (memberStudentStuNo) memberStudentStuNo.value = "";
                if (memberStudentGrade) memberStudentGrade.value = "";
                if (memberStudentMajor) memberStudentMajor.value = "";
                syncStudentAdminClassSelect(memberStudentAdminClass, "", "", "", "全部行政班");
                if (memberStudentAddedOnly) memberStudentAddedOnly.checked = false;
                state.memberPickerPage = 1;
                state.memberPickerImportedMode = false;
                loadMemberDirectory().catch(function (err) {
                    showResult(courseRelationResult, "查询失败", err.message || "学生查询失败。", true);
                });
            });
        }

        if (rosterImportBtn && rosterImportInput) {
            rosterImportBtn.addEventListener("click", function () {
                showImportHintToast();
                rosterImportInput.click();
            });

            rosterImportInput.addEventListener("change", function () {
                var courseId = state.selectedEditCourseId || editCourseSelect && editCourseSelect.value;
                var file = rosterImportInput.files && rosterImportInput.files[0];
                if (!courseId) {
                    showResult(courseRelationResult, "无法导入", "请先选择课程。", true);
                    rosterImportInput.value = "";
                    return;
                }
                if (!file) return;

                var formData = new FormData();
                formData.append("file", file);
                window.linkseeApi.postForm("/api/v1/courses/" + encodeURIComponent(courseId) + "/members/import-roster", formData)
                    .then(function (payload) {
                        var data = payload && payload.data ? payload.data : {};
                        var rows = Array.isArray(data.rows) ? data.rows : [];
                        var summary = data.summary || {};
                        state.memberPickerMode = "student";
                        state.memberPickerImportedMode = true;
                        state.memberPickerPage = 1;
                        state.memberPickerRows = rows;
                        state.memberPickerTotal = rows.length;
                        setSelectedIds("student", rows.filter(function (row) {
                            return String(row.importStatus || "") === "ready";
                        }).map(function (row) { return String(row.id || ""); }));
                        renderMemberPickerTable();
                        showResult(
                            courseRelationResult,
                            "导入完成",
                            "共读取 " + String(summary.totalRows || 0) + " 条，匹配 " + String(summary.matchedCount || 0) + " 条，自动勾选 " + String(summary.selectedCount || 0) + " 条，已在课程内 " + String(summary.alreadyJoinedCount || 0) + " 条，未找到 " + String(summary.notFoundCount || 0) + " 条，姓名不符 " + String(summary.nameMismatchCount || 0) + " 条。",
                            Boolean(summary.notFoundCount || summary.nameMismatchCount)
                        );
                    })
                    .catch(function (err) {
                        showResult(courseRelationResult, "导入失败", err.message || "选课名单导入失败。", true);
                    })
                    .finally(function () {
                        rosterImportInput.value = "";
                    });
            });
        }

        if (memberTeacherResetBtn) {
            memberTeacherResetBtn.addEventListener("click", function () {
                if (memberTeacherName) memberTeacherName.value = "";
                if (memberTeacherNo) memberTeacherNo.value = "";
                if (memberTeacherCollege) memberTeacherCollege.value = "";
                if (memberTeacherAddedOnly) memberTeacherAddedOnly.checked = false;
                state.memberPickerPage = 1;
                loadMemberDirectory().catch(function (err) {
                    showResult(courseRelationResult, "查询失败", err.message || "教师查询失败。", true);
                });
            });
        }

        if (memberStudentAddedOnly) {
            memberStudentAddedOnly.addEventListener("change", function () {
                state.memberPickerPage = 1;
                loadMemberDirectory().catch(function (err) {
                    showResult(courseRelationResult, "加载失败", err.message || "学生目录加载失败。", true);
                });
            });
        }

        if (memberTeacherAddedOnly) {
            memberTeacherAddedOnly.addEventListener("change", function () {
                state.memberPickerPage = 1;
                loadMemberDirectory().catch(function (err) {
                    showResult(courseRelationResult, "加载失败", err.message || "教师目录加载失败。", true);
                });
            });
        }

        if (memberTeacherRole) {
            memberTeacherRole.addEventListener("change", renderMemberPickerTable);
        }

        if (memberPickerTable && memberPickerTable.dataset.boundPickerActions !== "1") {
            memberPickerTable.dataset.boundPickerActions = "1";
            memberPickerTable.addEventListener("change", function (event) {
                var trigger = event.target && event.target.closest ? event.target.closest("[data-member-select]") : null;
                if (!trigger) return;
                var id = trigger.getAttribute("data-member-select") || "";
                var selected = getSelectedIds(state.memberPickerMode);
                if (trigger.checked) {
                    selected.add(id);
                } else {
                    selected.delete(id);
                }
                setSelectedIds(state.memberPickerMode, Array.from(selected));
                updateMemberPickerSummary();
            });
        }

        if (memberSelectAll) {
            memberSelectAll.addEventListener("change", function () {
                var rows = filteredModalRows();
                var selected = getSelectedIds(state.memberPickerMode);
                rows.forEach(function (row) {
                    var id = String(row.id || "");
                    if (memberSelectAll.checked) {
                        if (!currentBoundIdSet().has(id)) selected.add(id);
                    } else {
                        selected.delete(id);
                    }
                });
                setSelectedIds(state.memberPickerMode, Array.from(selected));
                renderMemberPickerTable();
            });
        }

        if (memberPageButtons && memberPageButtons.dataset.boundPages !== "1") {
            memberPageButtons.dataset.boundPages = "1";
            memberPageButtons.addEventListener("click", function (event) {
                var trigger = event.target && event.target.closest ? event.target.closest("[data-member-page]") : null;
                if (!trigger) return;
                state.memberPickerPage = Number(trigger.getAttribute("data-member-page") || "1");
                loadMemberDirectory().catch(function (err) {
                    showResult(courseRelationResult, "加载失败", err.message || "成员目录加载失败。", true);
                });
            });
        }

        if (memberPrevPageBtn) {
            memberPrevPageBtn.addEventListener("click", function () {
                if (state.memberPickerPage <= 1) return;
                state.memberPickerPage -= 1;
                loadMemberDirectory().catch(function (err) {
                    showResult(courseRelationResult, "加载失败", err.message || "成员目录加载失败。", true);
                });
            });
        }

        if (memberNextPageBtn) {
            memberNextPageBtn.addEventListener("click", function () {
                var totalPages = Math.max(1, Math.ceil((state.memberPickerTotal || 0) / state.memberPickerPageSize));
                if (state.memberPickerPage >= totalPages) return;
                state.memberPickerPage += 1;
                loadMemberDirectory().catch(function (err) {
                    showResult(courseRelationResult, "加载失败", err.message || "成员目录加载失败。", true);
                });
            });
        }

        if (memberPickerApplyBtn) {
            memberPickerApplyBtn.addEventListener("click", function () {
                var courseId = state.selectedEditCourseId || editCourseSelect && editCourseSelect.value;
                var ids = Array.from(getSelectedIds(state.memberPickerMode));
                if (!courseId) {
                    showResult(courseRelationResult, "无法加入", "请先选择课程。", true);
                    return;
                }
                if (!ids.length) {
                    showResult(courseRelationResult, "无法加入", "请先勾选成员。", true);
                    return;
                }
                hideResult(courseRelationResult);
                var tasks = state.memberPickerMode === "student"
                    ? ids.map(function (id) {
                        return window.linkseeApi.postJson("/api/v1/courses/" + encodeURIComponent(courseId) + "/members", { userId: id });
                    })
                    : ids.map(function (id) {
                        return window.linkseeApi.postJson("/api/v1/courses/" + encodeURIComponent(courseId) + "/teachers", {
                            userId: id,
                            role: memberTeacherRole ? memberTeacherRole.value : "lead",
                        });
                    });
                Promise.all(tasks).then(function () {
                    setSelectedIds(state.memberPickerMode, []);
                    showResult(courseRelationResult, "加入成功", (state.memberPickerMode === "student" ? "学生" : "教师") + "已加入当前课程。", false);
                    closeMemberPicker();
                    return refreshCourseRelationData();
                }).catch(function (err) {
                    showResult(courseRelationResult, "加入失败", err.message || "成员加入失败。", true);
                });
            });
        }

        if (courseRelationTeachers && courseRelationTeachers.dataset.boundQuickActions !== "1") {
            courseRelationTeachers.dataset.boundQuickActions = "1";
            courseRelationTeachers.addEventListener("click", function (event) {
                var trigger = event.target && event.target.closest ? event.target.closest("[data-course-quick-teacher-remove]") : null;
                var courseId = state.selectedEditCourseId || editCourseSelect && editCourseSelect.value;
                var teacherId = trigger ? (trigger.getAttribute("data-course-quick-teacher-remove") || "") : "";
                if (!courseId || !teacherId) return;
                hideResult(courseRelationResult);
                window.linkseeApi.request("/api/v1/courses/" + encodeURIComponent(courseId) + "/teachers/" + encodeURIComponent(teacherId), {
                    method: "DELETE",
                    headers: window.linkseeApi.authHeaders(),
                }).then(function (payload) {
                    var removedAssistants = payload && payload.data ? Number(payload.data.removedAssistants || 0) : 0;
                    var successMessage = removedAssistants > 0
                        ? "教师已移出，关联助教已同步移除。"
                        : "教师已从当前课程移出。";
                    showResult(courseRelationResult, "移出成功", successMessage, false);
                    return Promise.all([refreshAcademicData(), refreshCourseRelationData()]);
                }).catch(function (err) {
                    showResult(courseRelationResult, "移除失败", err.message || "教师移出失败。", true);
                });
            });
        }

        if (studentDetailCloseBtn) {
            studentDetailCloseBtn.addEventListener("click", closeStudentDetail);
        }

        Array.from(document.querySelectorAll("[data-student-detail-close]")).forEach(function (node) {
            node.addEventListener("click", closeStudentDetail);
        });

        if (studentDetailSaveBtn) {
            studentDetailSaveBtn.addEventListener("click", function () {
                var userId = String(state.selectedStudentMemberId || "");
                if (!userId) return;
                window.linkseeApi.patchJson("/api/v1/users/" + encodeURIComponent(userId), {
                    realName: studentDetailName ? studentDetailName.value.trim() : "",
                    grade: studentDetailGrade ? studentDetailGrade.value.trim() : "",
                    major: studentDetailMajor ? studentDetailMajor.value.trim() : "",
                    adminClass: studentDetailAdminClass ? studentDetailAdminClass.value.trim() : "",
                }).then(function () {
                    showResult(courseRelationResult, "保存成功", "学生信息已更新。", false);
                    return refreshCourseRelationData();
                }).then(function () {
                    openStudentDetail(userId);
                }).catch(function (err) {
                    showResult(courseRelationResult, "保存失败", err.message || "学生信息更新失败。", true);
                });
            });
        }

        if (studentDetailRemoveBtn) {
            studentDetailRemoveBtn.addEventListener("click", function () {
                var courseId = state.selectedEditCourseId || editCourseSelect && editCourseSelect.value;
                var userId = String(state.selectedStudentMemberId || "");
                if (!courseId || !userId) return;
                window.linkseeApi.request("/api/v1/courses/" + encodeURIComponent(courseId) + "/members/" + encodeURIComponent(userId), {
                    method: "DELETE",
                    headers: window.linkseeApi.authHeaders(),
                }).then(function () {
                    closeStudentDetail();
                    showResult(courseRelationResult, "移出成功", "学生已从当前课程移出。", false);
                    return refreshCourseRelationData();
                }).catch(function (err) {
                    showResult(courseRelationResult, "移除失败", err.message || "学生移出失败。", true);
                });
            });
        }

        if (batchStudentClearBtn) {
            batchStudentClearBtn.addEventListener("click", function () {
                if (batchStudents) batchStudents.value = "";
                hideResult(batchResult);
            });
        }

        if (batchTeacherClearBtn) {
            batchTeacherClearBtn.addEventListener("click", function () {
                if (batchTeachers) batchTeachers.value = "";
                hideResult(batchResult);
            });
        }

        if (batchStudentSubmitBtn) {
            batchStudentSubmitBtn.addEventListener("click", function () {
                var rows = normalizeCsvLines(batchStudents ? batchStudents.value : "");
                if (!rows.length) {
                    showResult(batchResult, "无法创建", "请先输入学生批量数据。", true);
                    return;
                }

                hideResult(batchResult);
                var students = rows.map(function (cols) {
                    return {
                        id: cols[0] || "",
                        realName: cols[1] || "",
                        stuNo: cols[2] || "",
                        grade: cols[3] ? Number(cols[3]) : "",
                        cohort: cols[4] ? Number(cols[4]) : "",
                        major: cols[5] || "",
                        adminClass: cols[6] || "",
                    };
                });
                var body = { students: students };
                if (batchDefaultPassword && batchDefaultPassword.value.trim()) {
                    body.defaultPassword = batchDefaultPassword.value.trim();
                }

                window.linkseeApi.postJson("/api/v1/users/batch/students", body)
                    .then(function (payload) {
                        showBatchResult(payload, "学生");
                        if (batchStudents) batchStudents.value = "";
                    })
                    .catch(function (err) {
                        showResult(batchResult, "创建失败", err.message || "学生批量建号失败。", true);
                    });
            });
        }

        if (batchTeacherSubmitBtn) {
            batchTeacherSubmitBtn.addEventListener("click", function () {
                var rows = normalizeCsvLines(batchTeachers ? batchTeachers.value : "");
                if (!rows.length) {
                    showResult(batchResult, "无法创建", "请先输入教师批量数据。", true);
                    return;
                }

                hideResult(batchResult);
                var teachers = rows.map(function (cols) {
                    return {
                        id: cols[0] || "",
                        realName: cols[1] || "",
                        teacherNo: cols[2] || "",
                        title: cols[3] || "",
                        college: cols[4] || "",
                        researchDirection: cols[5] || "",
                    };
                });
                var body = { teachers: teachers };
                if (batchDefaultPassword && batchDefaultPassword.value.trim()) {
                    body.defaultPassword = batchDefaultPassword.value.trim();
                }

                window.linkseeApi.postJson("/api/v1/users/batch/teachers", body)
                    .then(function (payload) {
                        showBatchResult(payload, "教师");
                        if (batchTeachers) batchTeachers.value = "";
                    })
                    .catch(function (err) {
                        showResult(batchResult, "创建失败", err.message || "教师批量建号失败。", true);
                    });
            });
        }
    };
})();
