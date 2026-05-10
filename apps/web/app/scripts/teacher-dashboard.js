(function () {
    function initTeacherReviewList() {
        var reviewItems = document.querySelectorAll("#teacherReviewList .list-item");
        if (!reviewItems.length) {
            return;
        }

        reviewItems.forEach(function (item) {
            item.addEventListener("click", function () {
                reviewItems.forEach(function (el) {
                    el.classList.remove("dashboard-list-item-selected");
                    var staleBadge = el.querySelector(".badge");
                    if (staleBadge && staleBadge.textContent === "selected") {
                        staleBadge.className = "badge badge-submitted";
                        staleBadge.textContent = "new";
                    }
                });

                item.classList.add("dashboard-list-item-selected");
                var activeBadge = item.querySelector(".badge");
                if (activeBadge) {
                    activeBadge.className = "badge badge-pending";
                    activeBadge.textContent = "selected";
                }
            });
        });
    }

    window.initTeacherDashboard = function initTeacherDashboard() {
        initTeacherReviewList();
    };
})();
