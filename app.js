(function () {
    // Configuration and constants
    const CONFIG = {
        STORAGE_KEY: "osrsGuideProgress",
        SCROLL_DELAY: 200,
        WIKI_BASE: "https://oldschool.runescape.wiki/w/"
    };

    let guideData = {};
    let episodeOrder = [];

    // Initialize app - load episodes from window.guideEpisodes (loaded via data.js)
    function initializeApp() {
        try {
            const episodes = Array.isArray(window.guideEpisodes) ? window.guideEpisodes : [];

            episodes.forEach((episode) => {
                if (!episode || !episode.title || !Array.isArray(episode.banks)) {
                    return;
                }

                guideData[episode.title] = episode.banks;
                episodeOrder.push(episode.title);
            });

            if (episodeOrder.length === 0) {
                throw new Error("No episode data found in window.guideEpisodes");
            }

            window.guideEpisodes = null;

            // Now that data is loaded, initialize the UI
            setupUI();
        } catch (error) {
            console.error("Failed to initialize app:", error);
            showErrorMessage("Failed to load guide data. Please refresh the page.");
        }
    }

    function showErrorMessage(message) {
        const checklistContainer = document.getElementById("checklistContainer");
        if (checklistContainer) {
            checklistContainer.textContent = message;
        }
    }

    let currentEpisode = null;
    let progress = {};
    const expandedBanks = new Set();

    let progressText, progressFill, progressPercent, checklistContainer, episodeButtons;

    function saveProgress() {
        try {
            localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(progress));
        } catch (error) {
            if (error.name === 'QuotaExceededError') {
                console.warn('Local storage quota exceeded - progress may not be fully saved');
            } else {
                console.error('Error saving progress:', error);
            }
        }
    }

    // Setup UI and event listeners - called after data is loaded
    function setupUI() {
        if (episodeOrder.length === 0) {
            showErrorMessage("No episode data loaded. Add data files in /data and refresh.");
            return;
        }

        // Cache DOM references
        progressText = document.getElementById("progressText");
        progressFill = document.getElementById("progressFill");
        progressPercent = document.getElementById("progressPercent");
        checklistContainer = document.getElementById("checklistContainer");
        episodeButtons = document.getElementById("episodeButtons");

        currentEpisode = episodeOrder[0];
        progress = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY) || "{}");

        // Attach event listeners
        const continueBtn = document.getElementById("continueRunBtn");
        const expandAllBtn = document.getElementById("expandAllBtn");
        const resetBtn = document.getElementById("resetProgressBtn");
        const markAllBtn = document.getElementById("markAllBtn");

        if (continueBtn) continueBtn.addEventListener("click", continueRun);
        if (expandAllBtn) expandAllBtn.addEventListener("click", toggleAllBanks);
        if (resetBtn) resetBtn.addEventListener("click", resetProgress);
        if (markAllBtn) markAllBtn.addEventListener("click", markAllTasksInEpisode);

        // Progress bar utility buttons
        const resumeBtn = document.getElementById("resumeBtn");
        const topBtn = document.getElementById("topBtn");
        const prevBtn = document.getElementById("prevEpisodeBtn");
        const nextBtn = document.getElementById("nextEpisodeBtn");

        if (resumeBtn) resumeBtn.addEventListener("click", resumePosition);
        if (topBtn) topBtn.addEventListener("click", scrollToTop);
        if (prevBtn) prevBtn.addEventListener("click", goToPreviousEpisode);
        if (nextBtn) nextBtn.addEventListener("click", goToNextEpisode);

        // Delegated handler for episode button selection
        if (episodeButtons) {
            episodeButtons.addEventListener("click", (e) => {
                const btn = e.target.closest(".btn[data-episode-index]");
                if (!btn) return;
                currentEpisode = episodeOrder[parseInt(btn.dataset.episodeIndex, 10)];
                expandedBanks.clear();
                updateActiveEpisodeButton();
                renderChecklist();
                updateProgressBar();
                updateBankToggleButton();
                updateEpisodeNavButtons();
            });
        }

        // Delegated handlers for all checklist interactions
        checklistContainer.addEventListener("change", handleCheckboxChange);
        checklistContainer.addEventListener("click", handleChecklistClick);
        checklistContainer.addEventListener("keydown", handleChecklistKeydown);

        // Initialize tooltips
        initTooltips();

        // Render initial UI
        renderEpisodeButtons();
        renderChecklist();
        updateProgressBar();
        updateBankToggleButton();
        updateEpisodeNavButtons();
    }

    function initTooltips() {
        const tooltipEl = document.createElement("div");
        tooltipEl.className = "osrs-tooltip osrs-tooltip-fixed";
        tooltipEl.setAttribute("role", "tooltip");
        document.body.appendChild(tooltipEl);

        let currentWrap = null;

        document.addEventListener("mouseover", function (e) {
            const wrap = e.target.closest(".tooltip-wrap[data-tooltip]");
            if (wrap && wrap !== currentWrap) {
                currentWrap = wrap;
                const text = wrap.dataset.tooltip;
                if (!text) return;
                const rect = wrap.getBoundingClientRect();
                tooltipEl.textContent = text;
                tooltipEl.style.opacity = "1";
                tooltipEl.style.left = rect.left + rect.width / 2 + "px";
                tooltipEl.style.top = rect.top - 4 + "px";
                tooltipEl.style.transform = "translate(-50%, -100%)";
                tooltipEl.style.bottom = "auto";
            }
        });
        document.addEventListener("mouseout", function (e) {
            const wrap = e.target.closest(".tooltip-wrap[data-tooltip]");
            if (wrap) {
                const related = e.relatedTarget;
                if (!related || !wrap.contains(related)) {
                    currentWrap = null;
                    tooltipEl.style.opacity = "0";
                }
            }
        });
    }

    function updateBankProgressCount(bankIndex) {
        if (!currentEpisode) return;
        const bank = guideData[currentEpisode]?.[bankIndex];
        if (!bank) return;
        const bankProgress = progress[currentEpisode]?.[bankIndex];
        const completed = Array.isArray(bankProgress)
            ? Math.min(bankProgress.filter(Boolean).length, bank.tasks.length)
            : 0;
        const bankSection = document.querySelector(
            `.bank-content[data-bank-id="${currentEpisode}-bank-${bankIndex}"]`
        )?.closest(".bank-section");
        if (!bankSection) return;
        const countEl = bankSection.querySelector(".bank-progress-count");
        const fillEl = bankSection.querySelector(".bank-progress-fill");
        if (countEl) {
            countEl.textContent = `${completed}/${bank.tasks.length}`;
        }
        if (fillEl && bank.tasks.length > 0) {
            fillEl.style.width = `${(completed / bank.tasks.length) * 100}%`;
        }
    }

    function updateProgressBar() {
        if (!currentEpisode) {
            return;
        }

        let total = 0;
        let done = 0;

        guideData[currentEpisode].forEach((bank, bankIndex) => {
            total += bank.tasks.length;

            if (progress[currentEpisode]?.[bankIndex]) {
                done += progress[currentEpisode][bankIndex].filter(Boolean).length;
            }
        });

        const percent = total ? Math.round((done / total) * 100) : 0;
        progressFill.style.width = `${percent}%`;
        progressText.textContent = `${done} / ${total}`;
        if (progressPercent) {
            progressPercent.textContent = `${percent}%`;
        }
    }

    function renderEpisodeButtons() {
        if (episodeOrder.length === 0 || !episodeButtons) {
            return;
        }

        episodeButtons.replaceChildren();

        episodeOrder.forEach((episode, index) => {
            const wrap = document.createElement("div");
            wrap.className = "tooltip-wrap";
            wrap.dataset.tooltip = episode;

            const btn = document.createElement("button");
            btn.className = "btn";
            btn.type = "button";
            btn.textContent = `E${index + 1}`;
            btn.dataset.episodeIndex = index;

            wrap.appendChild(btn);
            episodeButtons.appendChild(wrap);
        });

        updateActiveEpisodeButton();
    }

    function updateActiveEpisodeButton() {
        if (!episodeButtons) return;
        const currentIndex = episodeOrder.indexOf(currentEpisode);
        episodeButtons.querySelectorAll(".btn").forEach((btn, i) => {
            btn.classList.toggle("active", i === currentIndex);
        });
    }

    function toggleBank(bankId) {
        const bank = document.querySelector(`[data-bank-id="${bankId}"]`);

        if (!bank) {
            return;
        }

        if (bank.classList.contains("active")) {
            bank.classList.remove("active");
            expandedBanks.delete(bankId);
        } else {
            bank.classList.add("active");
            expandedBanks.add(bankId);
        }

        // Update aria-expanded for accessibility
        const header = bank.closest(".bank-section")?.querySelector(".bank-header");
        if (header) {
            header.setAttribute("aria-expanded", bank.classList.contains("active"));
        }

        updateBankToggleButton();
    }

    function expandAll() {
        document.querySelectorAll(".bank-content").forEach((bankElement) => {
            bankElement.classList.add("active");
            expandedBanks.add(bankElement.dataset.bankId);
            const header = bankElement.closest(".bank-section")?.querySelector(".bank-header");
            if (header) header.setAttribute("aria-expanded", "true");
        });
        updateBankToggleButton();
    }

    function collapseAll() {
        document.querySelectorAll(".bank-content").forEach((bankElement) => {
            bankElement.classList.remove("active");
            expandedBanks.delete(bankElement.dataset.bankId);
            const header = bankElement.closest(".bank-section")?.querySelector(".bank-header");
            if (header) header.setAttribute("aria-expanded", "false");
        });
        updateBankToggleButton();
    }

    function areAllBanksExpanded() {
        if (!currentEpisode) {
            return false;
        }

        const bankCount = guideData[currentEpisode]?.length || 0;
        if (!bankCount) {
            return false;
        }

        for (let bankIndex = 0; bankIndex < bankCount; bankIndex++) {
            const bankId = `${currentEpisode}-bank-${bankIndex}`;
            if (!expandedBanks.has(bankId)) {
                return false;
            }
        }

        return true;
    }

    function updateBankToggleButton() {
        const button = document.getElementById("expandAllBtn");
        const tooltipWrap = document.getElementById("expandAllTooltip");
        if (!button || !currentEpisode) {
            return;
        }

        const isExpanded = areAllBanksExpanded();
        if (tooltipWrap) {
            tooltipWrap.dataset.tooltip = isExpanded ? "Collapse all banks" : "Expand all banks";
        }

        const icon = button.querySelector(".material-symbols-outlined");
        if (icon) {
            icon.textContent = isExpanded ? button.dataset.iconCollapse : button.dataset.iconExpand;
        }
    }

    function toggleAllBanks() {
        if (!currentEpisode) {
            return;
        }

        if (areAllBanksExpanded()) {
            collapseAll();
        } else {
            expandAll();
        }
    }

    function toggleBankCompletion(bankIndex) {
        if (!currentEpisode) {
            return;
        }

        const taskCount = guideData[currentEpisode]?.[bankIndex]?.tasks?.length || 0;
        if (!taskCount) {
            return;
        }

        if (!progress[currentEpisode]) {
            progress[currentEpisode] = {};
        }

        const currentBankProgress = progress[currentEpisode]?.[bankIndex] || [];
        const doneCount = currentBankProgress.filter(Boolean).length;
        const shouldUnmark = doneCount >= taskCount;
        progress[currentEpisode][bankIndex] = Array(taskCount).fill(!shouldUnmark);

        saveProgress();
        renderChecklist();
        updateProgressBar();

        if (!shouldUnmark) {
            triggerBankCompletion(bankIndex);
        }
    }

    function splitTopLevel(str, delimiter) {
        const parts = [];
        let current = "";
        let depth = 0;

        for (let i = 0; i < str.length; i++) {
            const char = str[i];

            if (char === "(" || char === "[" || char === "{") {
                depth++;
            } else if (char === ")" || char === "]" || char === "}") {
                depth = Math.max(0, depth - 1);
            }

            if (char === delimiter && depth === 0) {
                const trimmed = current.trim();
                if (trimmed) parts.push(trimmed);
                current = "";
            } else {
                current += char;
            }
        }

        const trimmed = current.trim();
        if (trimmed) parts.push(trimmed);

        return parts;
    }

    function wikiUrl(articleTitle) {
        const slug = articleTitle.replace(/\s+/g, "_");
        return CONFIG.WIKI_BASE + encodeURIComponent(slug).replace(/%2F/g, "/");
    }

    function renderTextWithLinks(parentEl, text) {
        const regex = /\[([^\]]+)\]/g;
        let lastIndex = 0;
        let match;
        while ((match = regex.exec(text)) !== null) {
            if (match.index > lastIndex) {
                parentEl.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
            }
            const link = document.createElement("a");
            link.href = wikiUrl(match[1]);
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.textContent = match[1];
            link.className = "wiki-link";
            parentEl.appendChild(link);
            lastIndex = regex.lastIndex;
        }
        if (lastIndex < text.length) {
            parentEl.appendChild(document.createTextNode(text.slice(lastIndex)));
        }
    }

    function parseInventorySlotNote(taskLine) {
        const match = taskLine.match(/^(.*)\(\s*([^)]+Inventory Slots[^)]*)\)\s*$/i);
        if (!match) {
            return { cleanLine: taskLine, inventoryNote: null };
        }

        return {
            cleanLine: match[1].trim().replace(/[,\s]+$/, ""),
            inventoryNote: match[2].trim()
        };
    }

    function parseWithdrawTask(task) {
        const match = task.match(/^withdraw\b\s*:?\s*(.+)$/i);
        if (!match) {
            return null;
        }

        const fullText = match[1].trim();
        if (!fullText) {
            return { items: [], inventoryNote: null };
        }

        const segments = splitTopLevel(fullText, "+");
        const items = [];
        const notes = new Set();

        segments.forEach((segment) => {
            splitTopLevel(segment, ",").forEach((entry) => {
                const parsed = parseInventorySlotNote(entry);
                if (parsed.inventoryNote) {
                    notes.add(parsed.inventoryNote);
                    if (parsed.cleanLine) {
                        items.push(parsed.cleanLine);
                    }
                } else {
                    items.push(parsed.cleanLine);
                }
            });
        });

        return {
            items: items.filter(Boolean),
            inventoryNote: notes.size ? ` (${Array.from(notes).join(" / ")})` : "",
        };
    }

    function handleCheckboxChange(e) {
        const checkbox = e.target;
        if (!checkbox.matches("input.checkbox")) return;

        const item = checkbox.closest(".checklist-item");
        if (!item) return;

        const bankIndex = parseInt(item.dataset.bankIndex, 10);
        const taskIndex = parseInt(item.dataset.taskIndex, 10);

        if (!progress[currentEpisode]) {
            progress[currentEpisode] = {};
        }
        if (!progress[currentEpisode][bankIndex]) {
            progress[currentEpisode][bankIndex] = [];
        }

        const wasComplete = isBankComplete(bankIndex);
        progress[currentEpisode][bankIndex][taskIndex] = checkbox.checked;

        if (checkbox.checked) {
            item.classList.add("completed");
            scrollToNextTask(item);
        } else {
            item.classList.remove("completed");
        }

        saveProgress();
        updateProgressBar();
        highlightNextTask();
        updateBankProgressCount(bankIndex);

        if (!wasComplete && isBankComplete(bankIndex)) {
            triggerBankCompletion(bankIndex);
        }
    }

    function handleChecklistClick(e) {
        const markAllBtn = e.target.closest(".mark-all-button");
        if (markAllBtn) {
            e.stopPropagation();
            const bankIndex = parseInt(markAllBtn.dataset.bankIndex, 10);
            toggleBankCompletion(bankIndex);
            return;
        }

        const header = e.target.closest(".bank-header");
        if (header) {
            toggleBank(header.dataset.bankToggleId);
            return;
        }

        const item = e.target.closest(".checklist-item");
        if (item) {
            const checkbox = item.querySelector("input.checkbox");
            if (checkbox && e.target !== checkbox) {
                checkbox.checked = !checkbox.checked;
                checkbox.dispatchEvent(new Event("change", { bubbles: true }));
            }
        }
    }

    function handleChecklistKeydown(e) {
        if (e.key !== "Enter" && e.key !== " ") return;
        const header = e.target.closest(".bank-header");
        if (header) {
            e.preventDefault();
            toggleBank(header.dataset.bankToggleId);
        }
    }

    function createTaskElement(task, taskIndex, bankIndex, bank) {
        const item = document.createElement("div");
        item.className = "checklist-item";
        item.dataset.bankIndex = bankIndex;
        item.dataset.taskIndex = taskIndex;

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.className = "checkbox";
        checkbox.checked = progress?.[currentEpisode]?.[bankIndex]?.[taskIndex] || false;

        if (checkbox.checked) {
            item.classList.add("completed");
        }

        const taskContent = document.createElement("div");
        taskContent.className = "task-content";

        const text = document.createElement("span");
        text.className = "task-text";

        const withdrawItems = parseWithdrawTask(task);
        if (withdrawItems) {
            const screenshotUrl = window.BANK_WITHDRAW_SCREENSHOTS?.[String(bank?.bank)];
            const withdrawWrapper = document.createElement("div");
            withdrawWrapper.className = "withdraw-wrapper";
            if (screenshotUrl) {
                withdrawWrapper.classList.add("has-screenshot");
            }

            renderTextWithLinks(text, `Withdraw${withdrawItems.inventoryNote || ":"}`);
            withdrawWrapper.appendChild(text);

            const sublist = document.createElement("ul");
            sublist.className = "withdraw-sublist";
            withdrawItems.items.forEach((withdrawItem) => {
                const withdrawTaskItem = document.createElement("li");
                withdrawTaskItem.className = "withdraw-subitem";
                renderTextWithLinks(withdrawTaskItem, withdrawItem);
                sublist.appendChild(withdrawTaskItem);
            });

            withdrawWrapper.appendChild(sublist);

            if (screenshotUrl) {
                const img = document.createElement("img");
                img.className = "withdraw-screenshot";
                img.src = screenshotUrl;
                img.alt = "Withdraw items reference";
                img.loading = "lazy";
                img.width = 200;
                img.height = 200;
                img.onerror = () => {
                    img.style.display = "none";
                    withdrawWrapper.classList.remove("has-screenshot");
                };
                withdrawWrapper.appendChild(img);
            }

            taskContent.appendChild(withdrawWrapper);
        } else {
            renderTextWithLinks(text, task);
            taskContent.appendChild(text);
        }

        item.appendChild(checkbox);
        item.appendChild(taskContent);

        return item;
    }

    let cachedHighlightedTask = null;

    function createFireworksEffect(element) {
        const rect = element.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const particleCount = 12;
        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement("div");
            particle.className = "firework-particle";
            const angle = (i / particleCount) * Math.PI * 2;
            const velocity = 150 + Math.random() * 100;
            const vx = Math.cos(angle) * velocity;
            const vy = Math.sin(angle) * velocity;

            particle.style.left = centerX + "px";
            particle.style.top = centerY + "px";
            document.body.appendChild(particle);

            const duration = 400 + Math.random() * 100;
            const startTime = performance.now();

            function animate(currentTime) {
                const elapsed = currentTime - startTime;
                const t = elapsed / duration;

                if (t >= 1) {
                    particle.remove();
                    return;
                }

                const x = centerX + vx * t;
                const y = centerY + vy * t + 50 * t * t;
                const opacity = 1 - t * t;

                particle.style.left = x + "px";
                particle.style.top = y + "px";
                particle.style.opacity = opacity;

                requestAnimationFrame(animate);
            }

            requestAnimationFrame(animate);
        }
    }

    function triggerBankCompletion(bankIndex) {
        const bankId = `${currentEpisode}-bank-${bankIndex}`;
        const bankElement = document.querySelector(`[data-bank-id="${bankId}"]`)?.closest(".bank-section");
        if (bankElement) {
            createFireworksEffect(bankElement);
        }
    }

    function highlightNextTask() {
        if (cachedHighlightedTask) {
            cachedHighlightedTask.classList.remove("next-task");
            cachedHighlightedTask = null;
        }

        const tasks = checklistContainer.querySelectorAll(".checklist-item");
        for (const item of tasks) {
            const cb = item.querySelector("input");

            if (!cb.checked) {
                item.classList.add("next-task");
                cachedHighlightedTask = item;
                break;
            }
        }
    }

    function scrollToNextTask(current) {
        const tasks = [...checklistContainer.querySelectorAll(".checklist-item")];
        const index = tasks.indexOf(current);

        if (index === -1) {
            return;
        }

        for (let i = index + 1; i < tasks.length; i++) {
            const cb = tasks[i].querySelector("input");

            if (!cb.checked) {
                tasks[i].scrollIntoView({ behavior: "smooth", block: "center" });
                break;
            }
        }
    }

    function continueRun() {
        for (const episode of episodeOrder) {
            for (let bankIndex = 0; bankIndex < guideData[episode].length; bankIndex++) {
                for (let taskIndex = 0; taskIndex < guideData[episode][bankIndex].tasks.length; taskIndex++) {
                    if (!progress?.[episode]?.[bankIndex]?.[taskIndex]) {
                        currentEpisode = episode;
                        expandedBanks.clear();
                        updateActiveEpisodeButton();
                        renderChecklist();
                        updateProgressBar();
                        updateEpisodeNavButtons();

                        setTimeout(() => {
                            const id = `${episode}-bank-${bankIndex}`;
                            toggleBank(id);

                            const bank = document.querySelector(`[data-bank-id="${id}"]`);
                            if (bank) {
                                const tasks = bank.querySelectorAll(".checklist-item");
                                tasks[taskIndex]?.scrollIntoView({ behavior: "smooth", block: "center" });
                            }
                        }, CONFIG.SCROLL_DELAY);

                        return;
                    }
                }
            }
        }

        alert("All tasks in all episodes are already completed.");
    }

    function resumePosition() {
        for (const episode of episodeOrder) {
            for (let bankIndex = 0; bankIndex < guideData[episode].length; bankIndex++) {
                for (let taskIndex = 0; taskIndex < guideData[episode][bankIndex].tasks.length; taskIndex++) {
                    if (!progress?.[episode]?.[bankIndex]?.[taskIndex]) {
                        if (episode !== currentEpisode) {
                            currentEpisode = episode;
                            expandedBanks.clear();
                            updateActiveEpisodeButton();
                            renderChecklist();
                            updateProgressBar();
                            updateEpisodeNavButtons();
                        }

                        const bankId = `${episode}-bank-${bankIndex}`;
                        const bankContent = document.querySelector(`[data-bank-id="${bankId}"]`);

                        if (bankContent) {
                            const wasCollapsed = !bankContent.classList.contains("active");
                            if (wasCollapsed) toggleBank(bankId);
                            setTimeout(() => {
                                const taskItems = bankContent.querySelectorAll(".checklist-item");
                                taskItems[taskIndex]?.scrollIntoView({ behavior: "smooth", block: "center" });
                            }, wasCollapsed ? CONFIG.SCROLL_DELAY : 0);
                        }
                        return;
                    }
                }
            }
        }
    }

    function scrollToTop() {
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function navigateToEpisodeIndex(index) {
        currentEpisode = episodeOrder[index];
        expandedBanks.clear();
        updateActiveEpisodeButton();
        renderChecklist();
        updateProgressBar();
        updateEpisodeNavButtons();
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function goToPreviousEpisode() {
        const currentIndex = episodeOrder.indexOf(currentEpisode);
        if (currentIndex > 0) navigateToEpisodeIndex(currentIndex - 1);
    }

    function goToNextEpisode() {
        const currentIndex = episodeOrder.indexOf(currentEpisode);
        if (currentIndex < episodeOrder.length - 1) navigateToEpisodeIndex(currentIndex + 1);
    }

    function updateEpisodeNavButtons() {
        const currentIndex = episodeOrder.indexOf(currentEpisode);
        const prevBtn = document.getElementById("prevEpisodeBtn");
        const nextBtn = document.getElementById("nextEpisodeBtn");

        if (prevBtn) {
            prevBtn.disabled = currentIndex === 0;
        }
        if (nextBtn) {
            nextBtn.disabled = currentIndex === episodeOrder.length - 1;
        }
    }

    function isBankComplete(bankIndex) {
        if (!currentEpisode) return false;
        const taskCount = guideData[currentEpisode]?.[bankIndex]?.tasks?.length || 0;
        if (!taskCount) return false;
        const done = progress[currentEpisode]?.[bankIndex]?.filter(Boolean).length || 0;
        return done >= taskCount;
    }

    function areAllEpisodeTasksComplete() {
        if (!currentEpisode) return false;
        return guideData[currentEpisode].every((bank, bankIndex) => {
            const done = progress[currentEpisode]?.[bankIndex]?.filter(Boolean).length || 0;
            return done >= bank.tasks.length;
        });
    }

    function updateMarkAllIcon() {
        const btn = document.getElementById("markAllBtn");
        const tooltipWrap = document.getElementById("markAllTooltip");
        if (!btn) return;
        const icon = btn.querySelector(".material-symbols-outlined");
        const allDone = areAllEpisodeTasksComplete();
        if (icon) {
            icon.textContent = allDone ? btn.dataset.iconUnmark : btn.dataset.iconMark;
        }
        if (tooltipWrap) {
            tooltipWrap.dataset.tooltip = allDone ? "Unmark all tasks" : "Mark all complete";
        }
    }

    function markAllTasksInEpisode() {
        if (!currentEpisode) {
            return;
        }

        if (!progress[currentEpisode]) {
            progress[currentEpisode] = {};
        }

        const shouldMark = !areAllEpisodeTasksComplete();

        guideData[currentEpisode].forEach((bank, bankIndex) => {
            progress[currentEpisode][bankIndex] = Array(bank.tasks.length).fill(shouldMark);
        });

        saveProgress();
        renderChecklist();
        updateProgressBar();
    }

    function showResetDialog() {
        const backdrop = document.createElement("div");
        backdrop.className = "modal-backdrop";
        backdrop.id = "resetDialogBackdrop";

        const dialog = document.createElement("div");
        dialog.className = "modal-dialog";
        dialog.role = "alertdialog";
        dialog.setAttribute("aria-modal", "true");

        const header = document.createElement("div");
        header.className = "modal-header";
        header.textContent = "Reset Progress";

        const message = document.createElement("div");
        message.className = "modal-message";
        message.textContent = "All progress across every episode will be permanently cleared. This cannot be undone.";

        const footer = document.createElement("div");
        footer.className = "modal-footer";

        const cancelBtn = document.createElement("button");
        cancelBtn.type = "button";
        cancelBtn.className = "btn";
        cancelBtn.textContent = "Cancel";
        cancelBtn.addEventListener("click", closeDialog);

        const resetBtn = document.createElement("button");
        resetBtn.type = "button";
        resetBtn.className = "btn btn-danger";
        resetBtn.textContent = "Reset";
        resetBtn.addEventListener("click", () => {
            performReset();
            closeDialog();
        });

        footer.appendChild(cancelBtn);
        footer.appendChild(resetBtn);

        dialog.appendChild(header);
        dialog.appendChild(message);
        dialog.appendChild(footer);

        backdrop.appendChild(dialog);
        document.body.appendChild(backdrop);

        backdrop.addEventListener("click", (e) => {
            if (e.target === backdrop) closeDialog();
        });

        function closeDialog() {
            backdrop.remove();
        }
    }

    function performReset() {
        progress = {};
        saveProgress();
        renderChecklist();
        updateProgressBar();
    }

    function resetProgress() {
        if (episodeOrder.length === 0) {
            return;
        }

        showResetDialog();
    }

    function renderChecklist() {
        if (!currentEpisode) {
            return;
        }

        checklistContainer.replaceChildren();

        guideData[currentEpisode].forEach((bank, bankIndex) => {
            const bankId = `${currentEpisode}-bank-${bankIndex}`;

            const section = document.createElement("div");
            section.className = "bank-section";

            const header = document.createElement("div");
            header.className = "bank-header";

            const title = document.createElement("h3");
            const bankTitle = bank.bankLabel || `Bank ${bank.bank}`;
            title.textContent = bankTitle;

            const completed = progress[currentEpisode]?.[bankIndex]?.filter(Boolean).length || 0;
            const isBankDone = completed >= bank.tasks.length;

            const bankHeaderRight = document.createElement("div");
            bankHeaderRight.className = "bank-header-right";

            const count = document.createElement("span");
            count.className = "bank-progress-count";
            count.textContent = `${completed}/${bank.tasks.length}`;

            const markAllBtnWrap = document.createElement("div");
            markAllBtnWrap.className = "tooltip-wrap";
            markAllBtnWrap.dataset.tooltip = isBankDone ? "Unmark all tasks" : "Mark all tasks";

            const markAllButton = document.createElement("button");
            markAllButton.type = "button";
            markAllButton.className = "mark-all-button";
            markAllButton.setAttribute("aria-label", isBankDone ? "Unmark all tasks" : "Mark all tasks");

            const markAllIcon = document.createElement("span");
            markAllIcon.className = "material-symbols-outlined";
            markAllIcon.textContent = isBankDone ? "playlist_remove" : "playlist_add_check";
            markAllButton.appendChild(markAllIcon);

            markAllButton.dataset.bankIndex = bankIndex;

            markAllBtnWrap.appendChild(markAllButton);
            bankHeaderRight.appendChild(count);
            bankHeaderRight.appendChild(markAllBtnWrap);

            header.appendChild(title);
            header.appendChild(bankHeaderRight);
            header.dataset.bankToggleId = bankId;
            header.setAttribute("role", "button");
            header.setAttribute("tabindex", "0");
            header.setAttribute("aria-expanded", expandedBanks.has(bankId));

            const bar = document.createElement("div");
            bar.className = "bank-progress-bar";

            const fill = document.createElement("div");
            fill.className = "bank-progress-fill";
            fill.style.width = `${(completed / bank.tasks.length) * 100}%`;
            bar.appendChild(fill);

            const content = document.createElement("div");
            content.className = "bank-content";
            content.dataset.bankId = bankId;

            if (expandedBanks.has(bankId)) {
                content.classList.add("active");
            }

            bank.tasks.forEach((task, taskIndex) => {
                content.appendChild(createTaskElement(task, taskIndex, bankIndex, bank));
            });

            section.appendChild(header);
            section.appendChild(bar);
            section.appendChild(content);
            checklistContainer.appendChild(section);
        });

        updateBankToggleButton();
        updateMarkAllIcon();
        highlightNextTask();
    }


    // Export public API for testing and external integration
    window.GuideApp = {
        getCurrentEpisode: () => currentEpisode,
        getProgress: () => JSON.parse(JSON.stringify(progress)),
        resetProgress: resetProgress,
        continueRun: continueRun
    };

    // Initialize app when DOM is ready
    initializeApp();
})();
