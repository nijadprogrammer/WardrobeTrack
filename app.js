const DEFAULT_CATEGORIES = [
    { name: 'Shirts', slot: 'top', threshold: 2, builtIn: true },
    { name: 'Smart Casual', slot: 'top', threshold: 2, builtIn: true },
    { name: 'T-Shirts', slot: 'top', threshold: 2, builtIn: true },
    { name: 'Jubbah', slot: 'top', threshold: 3, builtIn: true },
    { name: 'Slacks', slot: 'bottom', threshold: 3, builtIn: true },
    { name: 'Jeans', slot: 'bottom', threshold: 4, builtIn: true },
    { name: 'Tracksuits', slot: 'bottom', threshold: 3, builtIn: true },
    { name: 'Kaili', slot: 'bottom', threshold: 3, builtIn: true },
    { name: 'Underwear', slot: 'underwear', threshold: 1, builtIn: true },
    { name: 'Suits', slot: 'suit', threshold: 5, builtIn: true }
];

const DEFAULT_LOCATIONS = ['Hostel', 'Home'];

let categories = JSON.parse(localStorage.getItem('wardrobe_categories')) || DEFAULT_CATEGORIES;
let locations = JSON.parse(localStorage.getItem('wardrobe_locations')) || DEFAULT_LOCATIONS;
let activeLocation = localStorage.getItem('wardrobe_active_location') || 'All';

// Migrate prior versions cleanly & ensure each item has a unique ID for presets
const rawWardrobe = JSON.parse(localStorage.getItem('wardrobe_data')) || [];
let wardrobe = rawWardrobe.map((item, idx) => ({
    ...item,
    id: item.id || `item_${Date.now()}_${idx}`,
    category: item.category === 'Shirt' ? 'Shirts' : item.category,
    location: item.location || 'Hostel',
    totalWears: item.totalWears !== undefined ? item.totalWears : (item.wears || 0),
    washCount: item.washCount || 0,
    inLaundry: item.inLaundry !== undefined ? item.inLaundry : (item.wears >= item.threshold)
}));

let activityLog = JSON.parse(localStorage.getItem('wardrobe_activity')) || [];
let presets = JSON.parse(localStorage.getItem('wardrobe_presets')) || [];
let laundryPrefs = JSON.parse(localStorage.getItem('wardrobe_laundry_prefs')) || {
    threshold: 5,
    enabled: true
};

let currentCategoryFilter = 'all';
let currentPhotoData = null;
let isPackMode = false;
let selectedPackIds = new Set();

function saveData() {
    localStorage.setItem('wardrobe_data', JSON.stringify(wardrobe));
    localStorage.setItem('wardrobe_activity', JSON.stringify(activityLog));
    localStorage.setItem('wardrobe_presets', JSON.stringify(presets));
    localStorage.setItem('wardrobe_categories', JSON.stringify(categories));
    localStorage.setItem('wardrobe_locations', JSON.stringify(locations));
    updateUI();
}

function saveLaundryPrefs() {
    laundryPrefs = {
        threshold: Math.max(1, parseInt(document.getElementById('prefThreshold').value) || 5),
        enabled: document.getElementById('prefEnabled').value === 'true'
    };
    localStorage.setItem('wardrobe_laundry_prefs', JSON.stringify(laundryPrefs));
    checkLaundryReminders();
}

function setActiveLocation(loc) {
    activeLocation = loc;
    localStorage.setItem('wardrobe_active_location', loc);
    updateUI();
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => {
        el.classList.toggle('active', el.dataset.tab === tabId);
    });
    document.getElementById(tabId).classList.add('active');
    updateUI();
}

function getCategoryObj(catName) {
    return categories.find(c => c.name === catName) || { name: catName, slot: 'top', threshold: 2 };
}

function getFilteredByLocation(list) {
    if (activeLocation === 'All') return list;
    return list.filter(item => (item.location || 'Hostel') === activeLocation);
}

/* ---------- PHOTO LIGHTBOX ---------- */
function openLightbox(index) {
    const item = wardrobe[index];
    if (!item || !item.photo) return;
    document.getElementById('lightboxTitle').innerText = item.name;
    document.getElementById('lightboxImg').src = item.photo;
    document.getElementById('lightboxMeta').innerText =
        `📍 ${item.location || 'Hostel'} • ${item.category} • Cycle: ${item.wears}/${item.threshold} • Lifetime: ${item.totalWears || 0}`;
    document.getElementById('photoLightbox').classList.add('active');
}

function closeLightbox() {
    document.getElementById('photoLightbox').classList.remove('active');
}

/* ---------- ITEM MODAL ---------- */
function onCategoryChange() {
    const catName = document.getElementById('itemCategory').value;
    const catObj = getCategoryObj(catName);
    const editIdx = document.getElementById('editIndex').value;

    if (editIdx === '') {
        document.getElementById('itemThreshold').value = catObj.threshold || 2;
    }

    const photoSection = document.getElementById('photoSection');
    const nameLabel = document.getElementById('nameLabel');
    if (catObj.slot === 'underwear') {
        photoSection.style.display = 'none';
        nameLabel.innerText = 'Label / Name (e.g., Black Cotton #1)';
    } else {
        photoSection.style.display = 'block';
        nameLabel.innerText = 'Item Name';
    }
}

function populateModalSelects() {
    const catSelect = document.getElementById('itemCategory');
    catSelect.innerHTML = categories.map(c =>
        `<option value="${c.name}">${c.name} (${c.slot.toUpperCase()})</option>`
    ).join('');

    const locSelect = document.getElementById('itemLocation');
    locSelect.innerHTML = locations.map(l =>
        `<option value="${l}">${l}</option>`
    ).join('');
}

function openItemModal(index = null) {
    const modal = document.getElementById('itemModal');
    const form = document.getElementById('itemForm');
    populateModalSelects();
    form.reset();
    currentPhotoData = null;
    document.getElementById('previewImage').style.display = 'none';

    if (index !== null) {
        const item = wardrobe[index];
        document.getElementById('modalTitle').innerText = 'Edit Item';
        document.getElementById('editIndex').value = index;
        document.getElementById('itemCategory').value = item.category;
        document.getElementById('itemLocation').value = item.location || 'Hostel';
        document.getElementById('itemName').value = item.name;
        document.getElementById('itemColor').value = item.color || '#2563eb';
        document.getElementById('itemThreshold').value = item.threshold;
        document.getElementById('itemLifetime').value = item.totalWears || 0;
        document.getElementById('lifetimeEditGroup').style.display = 'block';
        document.getElementById('deleteBtn').style.display = 'block';
        onCategoryChange();

        if (item.photo && getCategoryObj(item.category).slot !== 'underwear') {
            currentPhotoData = item.photo;
            const preview = document.getElementById('previewImage');
            preview.src = item.photo;
            preview.style.display = 'block';
        }
    } else {
        document.getElementById('modalTitle').innerText = 'Add Wardrobe Item';
        document.getElementById('editIndex').value = '';
        document.getElementById('lifetimeEditGroup').style.display = 'none';
        document.getElementById('deleteBtn').style.display = 'none';
        if (activeLocation !== 'All') {
            document.getElementById('itemLocation').value = activeLocation;
        }
        onCategoryChange();
    }
    modal.classList.add('active');
}

function closeItemModal() {
    document.getElementById('itemModal').classList.remove('active');
}

function previewPhoto(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                const MAX_SIZE = 500;
                let width = img.width;
                let height = img.height;
                if (width > height) {
                    if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
                } else {
                    if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
                }
                canvas.width = width;
                canvas.height = height;
                canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                currentPhotoData = canvas.toDataURL('image/jpeg', 0.84);
                const preview = document.getElementById('previewImage');
                preview.src = currentPhotoData;
                preview.style.display = 'block';
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function saveItem(e) {
    e.preventDefault();
    const index = document.getElementById('editIndex').value;
    const category = document.getElementById('itemCategory').value;
    const location = document.getElementById('itemLocation').value;
    const threshold = parseInt(document.getElementById('itemThreshold').value);
    const existing = index !== '' ? wardrobe[index] : null;
    const isUnderwear = getCategoryObj(category).slot === 'underwear';

    const currentWears = existing ? existing.wears : 0;
    const updatedLifetime = existing
        ? Math.max(0, parseInt(document.getElementById('itemLifetime').value) || 0)
        : 0;

    const itemData = {
        id: existing ? existing.id : `item_${Date.now()}`,
        name: document.getElementById('itemName').value.trim(),
        category,
        location,
        color: document.getElementById('itemColor').value,
        threshold,
        wears: currentWears,
        totalWears: updatedLifetime,
        washCount: existing ? existing.washCount : 0,
        lastWorn: existing ? existing.lastWorn : 'Never',
        inLaundry: existing ? (existing.inLaundry || currentWears >= threshold) : false,
        photo: isUnderwear ? null : (currentPhotoData || (existing ? existing.photo : null))
    };

    if (index !== '') wardrobe[index] = itemData;
    else wardrobe.push(itemData);

    saveData();
    closeItemModal();
}

function deleteItem() {
    const index = document.getElementById('editIndex').value;
    if (index !== '' && confirm(`Delete "${wardrobe[index].name}"?`)) {
        const removedId = wardrobe[index].id;
        wardrobe.splice(index, 1);
        presets.forEach(p => {
            p.itemIds = p.itemIds.filter(id => id !== removedId);
        });
        saveData();
        closeItemModal();
    }
}

/* ---------- TRAVEL PACKING BAG & LOCATION MOVE ---------- */
function moveItemLocation(index) {
    const currentLoc = wardrobe[index].location || 'Hostel';
    const currentIdx = locations.indexOf(currentLoc);
    const nextLoc = locations[(currentIdx + 1) % locations.length];
    wardrobe[index].location = nextLoc;
    saveData();
}

function togglePackMode() {
    isPackMode = !isPackMode;
    selectedPackIds.clear();
    const btn = document.getElementById('packModeBtn');
    const bar = document.getElementById('packActionBar');
    btn.classList.toggle('active-toggle', isPackMode);
    bar.classList.toggle('active', isPackMode);

    if (isPackMode) {
        const destSelect = document.getElementById('packDestinationSelect');
        destSelect.innerHTML = locations.map(l => `<option value="${l}">${l}</option>`).join('');
        // Pre-select opposite location if currently filtering by Hostel or Home
        if (activeLocation === 'Hostel' && locations.includes('Home')) destSelect.value = 'Home';
        else if (activeLocation === 'Home' && locations.includes('Hostel')) destSelect.value = 'Hostel';
    }
    updatePackCount();
    renderWardrobeList();
}

function togglePackItem(itemId) {
    if (selectedPackIds.has(itemId)) selectedPackIds.delete(itemId);
    else selectedPackIds.add(itemId);
    updatePackCount();
}

function selectAllVisibleForPack() {
    const visible = getVisibleWardrobeItems();
    visible.forEach(item => selectedPackIds.add(item.id));
    updatePackCount();
    renderWardrobeList();
}

function updatePackCount() {
    document.getElementById('packCount').innerText = selectedPackIds.size;
}

function executeBatchMove() {
    if (selectedPackIds.size === 0) {
        alert('Select at least one item to pack and move.');
        return;
    }
    const destination = document.getElementById('packDestinationSelect').value;
    let movedCount = 0;

    wardrobe.forEach(item => {
        if (selectedPackIds.has(item.id)) {
            item.location = destination;
            movedCount++;
        }
    });

    isPackMode = false;
    selectedPackIds.clear();
    document.getElementById('packModeBtn').classList.remove('active-toggle');
    document.getElementById('packActionBar').classList.remove('active');
    saveData();
    alert(`Moved ${movedCount} item(s) to ${destination}!`);
}

/* ---------- FAVORITE OUTFIT PRESETS ---------- */
function saveCurrentAsPreset() {
    const selectedIndices = [
        document.getElementById('logTopSelect').value,
        document.getElementById('logBottomSelect').value,
        document.getElementById('logUnderwearSelect').value,
        document.getElementById('logSuitSelect').value
    ].filter(val => val !== '').map(Number);

    if (selectedIndices.length === 0) {
        alert('Select at least one item in the dropdowns above before saving a preset.');
        return;
    }

    const name = prompt('Name this outfit preset (e.g., Monday Lab Fit, Presentation Combo):');
    if (!name || !name.trim()) return;

    const occasion = document.getElementById('logOccasion').value;
    const itemIds = selectedIndices.map(idx => wardrobe[idx].id);

    presets.push({
        id: `preset_${Date.now()}`,
        name: name.trim(),
        occasion,
        itemIds
    });

    saveData();
}

function logPreset(presetIndex) {
    const preset = presets[presetIndex];
    if (!preset) return;

    const matchedIndices = preset.itemIds
        .map(id => wardrobe.findIndex(item => item.id === id))
        .filter(idx => idx !== -1);

    if (matchedIndices.length === 0) {
        alert('The items in this preset no longer exist.');
        return;
    }

    logItemsByIndices(matchedIndices, preset.occasion);
}

function deletePreset(presetIndex) {
    if (confirm(`Remove preset "${presets[presetIndex].name}"?`)) {
        presets.splice(presetIndex, 1);
        saveData();
    }
}

function renderPresets() {
    const container = document.getElementById('presetsList');
    if (presets.length === 0) {
        container.innerHTML = '<div class="empty-msg">No presets saved yet. Select items below and tap <b>⭐ Save Preset</b> for 1-tap logging.</div>';
        return;
    }

    container.innerHTML = presets.map((preset, pIdx) => {
        const resolvedItems = preset.itemIds
            .map(id => wardrobe.find(item => item.id === id))
            .filter(Boolean);

        const unavailableReasons = [];
        resolvedItems.forEach(item => {
            if (item.inLaundry || item.wears >= item.threshold) {
                unavailableReasons.push(`${item.name} is in laundry`);
            } else if (activeLocation !== 'All' && (item.location || 'Hostel') !== activeLocation) {
                unavailableReasons.push(`${item.name} is at ${item.location}`);
            }
        });

        const isReady = resolvedItems.length > 0 && unavailableReasons.length === 0;
        const itemSummary = resolvedItems.map(i => i.name).join(' + ') || 'Missing items';

        return `
            <div class="preset-item">
                <div>
                    <div class="preset-title">${preset.name} <span class="tag">${preset.occasion}</span></div>
                    <div class="preset-sub">${itemSummary}</div>
                    ${!isReady && unavailableReasons.length > 0 ? `<div class="preset-sub" style="color:var(--danger);">⚠️ ${unavailableReasons.join(', ')}</div>` : ''}
                </div>
                <div class="action-btn-row">
                    <button class="btn btn-sm" ${!isReady ? 'disabled' : ''} onclick="logPreset(${pIdx})">Wear</button>
                    <button class="btn-delete-log" title="Delete Preset" onclick="deletePreset(${pIdx})">✕</button>
                </div>
            </div>
        `;
    }).join('');
}

/* ---------- CUSTOM CATEGORIES & LOCATIONS ---------- */
function openCategoryModal() {
    renderCustomCategories();
    document.getElementById('categoryModal').classList.add('active');
}
function closeCategoryModal() {
    document.getElementById('categoryModal').classList.remove('active');
}

function renderCustomCategories() {
    const list = document.getElementById('customCatList');
    list.innerHTML = categories.map((c, idx) => `
        <div class="custom-cat-row">
            <span><b>${c.name}</b> • ${c.slot.toUpperCase()} (limit: ${c.threshold})</span>
            ${!c.builtIn ? `<button type="button" class="btn btn-danger btn-sm" onclick="deleteCategory(${idx})">Remove</button>` : '<span class="tag">Default</span>'}
        </div>
    `).join('');
}

function saveNewCategory(e) {
    e.preventDefault();
    const name = document.getElementById('newCatName').value.trim();
    const slot = document.getElementById('newCatSlot').value;
    const threshold = parseInt(document.getElementById('newCatThreshold').value) || 2;

    if (categories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
        alert('Category already exists.');
        return;
    }

    categories.push({ name, slot, threshold, builtIn: false });
    document.getElementById('newCatName').value = '';
    saveData();
    renderCustomCategories();
}

function deleteCategory(idx) {
    const catName = categories[idx].name;
    if (wardrobe.some(i => i.category === catName)) {
        alert(`Cannot delete "${catName}" while items still use this category.`);
        return;
    }
    categories.splice(idx, 1);
    saveData();
    renderCustomCategories();
}

function openLocationModal() {
    renderLocationsModalList();
    document.getElementById('locationModal').classList.add('active');
}
function closeLocationModal() {
    document.getElementById('locationModal').classList.remove('active');
}

function renderLocationsModalList() {
    const list = document.getElementById('locationList');
    list.innerHTML = locations.map((loc, idx) => `
        <div class="custom-cat-row">
            <span>📍 <b>${loc}</b></span>
            ${idx >= 2 ? `<button type="button" class="btn btn-danger btn-sm" onclick="deleteLocation(${idx})">Remove</button>` : '<span class="tag">Default</span>'}
        </div>
    `).join('');
}

function saveNewLocation(e) {
    e.preventDefault();
    const name = document.getElementById('newLocName').value.trim();
    if (locations.some(l => l.toLowerCase() === name.toLowerCase())) {
        alert('Location already exists.');
        return;
    }
    locations.push(name);
    document.getElementById('newLocName').value = '';
    saveData();
    renderLocationsModalList();
}

function deleteLocation(idx) {
    const locName = locations[idx];
    if (wardrobe.some(i => i.location === locName)) {
        alert(`Move items out of "${locName}" before deleting this location.`);
        return;
    }
    if (activeLocation === locName) activeLocation = 'All';
    locations.splice(idx, 1);
    saveData();
    renderLocationsModalList();
}

/* ---------- LAUNDRY, LOGGING & TESTING RESET ---------- */
function sendToLaundry(index) {
    wardrobe[index].inLaundry = true;
    saveData();
}

function markWashed(index) {
    wardrobe[index].wears = 0;
    wardrobe[index].inLaundry = false;
    wardrobe[index].washCount = (wardrobe[index].washCount || 0) + 1;
    saveData();
}

function washAllLaundry() {
    wardrobe.forEach(item => {
        const matchesLoc = activeLocation === 'All' || (item.location || 'Hostel') === activeLocation;
        if (matchesLoc && (item.inLaundry || item.wears >= item.threshold)) {
            item.wears = 0;
            item.inLaundry = false;
            item.washCount = (item.washCount || 0) + 1;
        }
    });
    saveData();
}

function logItemsByIndices(indices, occasion) {
    const now = new Date().toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
    const wornNames = [];
    const wornIds = [];

    indices.forEach(idx => {
        const item = wardrobe[idx];
        item.wears += 1;
        item.totalWears = (item.totalWears || 0) + 1;
        item.lastWorn = now;
        if (item.wears >= item.threshold) {
            item.inLaundry = true;
        }
        wornNames.push(`${item.name} (${item.location || 'Hostel'})`);
        wornIds.push(item.id);
    });

    activityLog.unshift({
        id: Date.now(),
        date: now,
        occasion,
        items: wornNames,
        itemIds: wornIds
    });

    saveData();
}

function handleLogSubmit(e) {
    e.preventDefault();
    const selectedIndices = [
        document.getElementById('logTopSelect').value,
        document.getElementById('logBottomSelect').value,
        document.getElementById('logUnderwearSelect').value,
        document.getElementById('logSuitSelect').value
    ].filter(val => val !== '').map(Number);

    if (selectedIndices.length === 0) {
        alert('Please select at least one item to log.');
        return;
    }

    const occasion = document.getElementById('logOccasion').value;
    logItemsByIndices(selectedIndices, occasion);
}

function deleteActivity(logIndex) {
    const entry = activityLog[logIndex];
    if (!entry) return;

    if (confirm('Delete this activity entry and revert the wear count?')) {
        if (Array.isArray(entry.itemIds)) {
            entry.itemIds.forEach(id => {
                const item = wardrobe.find(i => i.id === id);
                if (item) {
                    item.wears = Math.max(0, item.wears - 1);
                    item.totalWears = Math.max(0, (item.totalWears || 1) - 1);
                    if (item.wears < item.threshold) {
                        item.inLaundry = false;
                    }
                }
            });
        }
        activityLog.splice(logIndex, 1);
        saveData();
    }
}

function clearAllActivity() {
    if (confirm('Clear all recent wear history logs? (Item wear stats will remain untouched.)')) {
        activityLog = [];
        saveData();
    }
}

function resetTestingStats() {
    if (confirm('Reset ALL cycle wears, lifetime wears, laundry status, and activity logs to 0?\n\nYour saved clothes, photos, presets, and locations will stay safe.')) {
        wardrobe.forEach(item => {
            item.wears = 0;
            item.totalWears = 0;
            item.washCount = 0;
            item.lastWorn = 'Never';
            item.inLaundry = false;
        });
        activityLog = [];
        saveData();
        alert('All wear stats and analytics have been reset to zero!');
    }
}

function checkLaundryReminders() {
    const locWardrobe = getFilteredByLocation(wardrobe);
    const dirtyCount = locWardrobe.filter(i => i.inLaundry || i.wears >= i.threshold).length;

    const badge = document.getElementById('laundryBadge');
    badge.innerText = dirtyCount;
    badge.style.display = dirtyCount > 0 ? 'inline-block' : 'none';

    const banner = document.getElementById('laundryAlertBanner');
    const text = document.getElementById('laundryAlertText');

    if (laundryPrefs.enabled && dirtyCount >= laundryPrefs.threshold) {
        const scopeText = activeLocation === 'All' ? 'your laundry basket' : `your <b>${activeLocation}</b> basket`;
        text.innerHTML = `🧺 <b>Laundry Limit Reached:</b> You have <b>${dirtyCount} items</b> in ${scopeText} (limit: ${laundryPrefs.threshold}).`;
        banner.classList.add('active');
    } else {
        banner.classList.remove('active');
    }
}

/* ---------- UI RENDERING ---------- */
function renderLocationBar() {
    const container = document.getElementById('locationPills');
    const allOptions = ['All', ...locations];
    container.innerHTML = allOptions.map(loc => `
        <button class="loc-pill ${activeLocation === loc ? 'active' : ''}" onclick="setActiveLocation('${loc}')">
            ${loc === 'All' ? 'All Wardrobes' : loc}
        </button>
    `).join('');

    document.getElementById('logLocationHint').innerText =
        activeLocation === 'All' ? 'Showing: All Locations' : `📍 ${activeLocation} Only`;
}

function renderCategoryFilters() {
    const container = document.getElementById('categoryFilters');
    const allCats = ['all', ...categories.map(c => c.name)];
    container.innerHTML = allCats.map(cat => `
        <button class="filter-pill ${currentCategoryFilter === cat ? 'active' : ''}" onclick="filterWardrobe('${cat}')">
            ${cat === 'all' ? 'All' : cat}
        </button>
    `).join('');
}

function updateUI() {
    renderLocationBar();
    renderCategoryFilters();
    renderPresets();

    const populateSelect = (id, slotType, placeholder) => {
        const el = document.getElementById(id);
        el.innerHTML = `<option value="">${placeholder}</option>`;
        wardrobe.forEach((item, idx) => {
            const catObj = getCategoryObj(item.category);
            const matchesLoc = activeLocation === 'All' || (item.location || 'Hostel') === activeLocation;
            if (catObj.slot === slotType && matchesLoc && !item.inLaundry && item.wears < item.threshold) {
                const locTag = activeLocation === 'All' ? ` [${item.location || 'Hostel'}]` : '';
                el.innerHTML += `<option value="${idx}">${item.name}${locTag} (${item.wears}/${item.threshold})</option>`;
            }
        });
    };

    populateSelect('logTopSelect', 'top', '-- None --');
    populateSelect('logBottomSelect', 'bottom', '-- None --');
    populateSelect('logUnderwearSelect', 'underwear', '-- None --');
    populateSelect('logSuitSelect', 'suit', '-- None --');

    // Recent Activity with Delete Buttons
    const activityList = document.getElementById('activityList');
    const clearBtn = document.getElementById('clearHistoryBtn');
    clearBtn.style.display = activityLog.length > 0 ? 'inline-block' : 'none';

    activityList.innerHTML = activityLog.slice(0, 20).map((act, idx) => `
        <div class="activity-item">
            <div class="activity-main">
                <div class="activity-top">
                    <b>${act.occasion}</b>
                    <span class="activity-date">${act.date}</span>
                </div>
                <div class="activity-details">${act.items ? act.items.join(', ') : act.details}</div>
            </div>
            <button class="btn-delete-log" title="Delete Entry" onclick="deleteActivity(${idx})">✕</button>
        </div>
    `).join('') || '<div class="empty-msg">No wears logged yet.</div>';

    document.getElementById('prefThreshold').value = laundryPrefs.threshold;
    document.getElementById('prefEnabled').value = String(laundryPrefs.enabled);

    renderWardrobeList();
    renderLaundryLists();
    renderInsights();
    checkLaundryReminders();
    updateStorageMeter();
}

function filterWardrobe(cat) {
    currentCategoryFilter = cat;
    renderCategoryFilters();
    renderWardrobeList();
}

function getVisibleWardrobeItems() {
    const searchQuery = (document.getElementById('wardrobeSearch')?.value || '').trim().toLowerCase();
    const sortBy = document.getElementById('wardrobeSort')?.value || 'default';

    let items = getFilteredByLocation(wardrobe);

    if (currentCategoryFilter !== 'all') {
        items = items.filter(i => i.category === currentCategoryFilter);
    }

    if (searchQuery) {
        items = items.filter(i =>
            i.name.toLowerCase().includes(searchQuery) ||
            i.category.toLowerCase().includes(searchQuery) ||
            (i.location || '').toLowerCase().includes(searchQuery)
        );
    }

    if (sortBy === 'ready') {
        items = [...items].sort((a, b) => {
            const aDirty = (a.inLaundry || a.wears >= a.threshold) ? 1 : 0;
            const bDirty = (b.inLaundry || b.wears >= b.threshold) ? 1 : 0;
            return aDirty - bDirty || a.wears - b.wears;
        });
    } else if (sortBy === 'leastWorn') {
        items = [...items].sort((a, b) => (a.totalWears || 0) - (b.totalWears || 0));
    } else if (sortBy === 'mostWorn') {
        items = [...items].sort((a, b) => (b.totalWears || 0) - (a.totalWears || 0));
    }

    return items;
}

function generateItemHtml(item, globalIndex, mode = 'wardrobe') {
    const isDirty = item.inLaundry || item.wears >= item.threshold;
    const percent = Math.min((item.wears / item.threshold) * 100, 100);
    let barClass = '';
    if (isDirty) barClass = 'danger';
    else if (percent >= 50) barClass = 'warning';

    const catObj = getCategoryObj(item.category);
    const thumb = (item.photo && catObj.slot !== 'underwear')
        ? `<img src="${item.photo}" class="item-thumb clickable-photo" alt="${item.name}" title="Tap to view full size" onclick="openLightbox(${globalIndex})">`
        : `<div class="item-thumb" style="background:${item.color || '#64748b'};">${item.category.slice(0,2).toUpperCase()}</div>`;

    const loc = item.location || 'Hostel';
    const locClass = loc === 'Home' ? 'loc-home' : 'loc-hostel';
    const locTag = `<span class="tag ${locClass}">📍 ${loc}</span>`;

    const catTag = catObj.slot === 'suit'
        ? `<span class="tag suit">${item.category} • Dry Clean</span>`
        : `<span class="tag">${item.category}</span>`;

    const dirtyTag = isDirty ? `<span class="tag laundry">In Laundry</span>` : '';

    let leadingControl = '';
    if (mode === 'wardrobe' && isPackMode) {
        const checked = selectedPackIds.has(item.id) ? 'checked' : '';
        leadingControl = `<input type="checkbox" class="pack-checkbox" ${checked} onchange="togglePackItem('${item.id}')">`;
    }

    let actionButtons = '';
    if (mode === 'laundry') {
        actionButtons = `<button class="btn btn-success btn-sm" onclick="markWashed(${globalIndex})">${catObj.slot === 'suit' ? 'Dry Cleaned' : 'Washed'}</button>`;
    } else if (!isPackMode) {
        actionButtons = `
            <div class="action-btn-row">
                <button class="btn btn-secondary btn-sm" title="Switch Location" onclick="moveItemLocation(${globalIndex})">⇄ Move</button>
                <button class="btn btn-secondary btn-sm" onclick="openItemModal(${globalIndex})">Edit</button>
            </div>
            ${!isDirty ? `<button class="btn btn-warn btn-sm" title="Send to Laundry Now" onclick="sendToLaundry(${globalIndex})">🧺 Laundry</button>` : ''}
        `;
    }

    return `
        <div class="item-row">
            ${leadingControl}
            ${thumb}
            <div class="item-info">
                <div class="item-header-line">
                    <span class="item-name">${item.name}</span>
                    ${locTag}
                    ${catTag}
                    ${dirtyTag}
                </div>
                <div class="item-meta">Cycle: ${item.wears}/${item.threshold} • Lifetime: ${item.totalWears || 0} • Last: ${item.lastWorn}</div>
                <div class="progress-bar"><div class="progress-fill ${barClass}" style="width: ${isDirty ? 100 : percent}%;"></div></div>
            </div>
            <div class="item-actions">${actionButtons}</div>
        </div>
    `;
}

function renderWardrobeList() {
    const list = document.getElementById('wardrobeList');
    const filtered = getVisibleWardrobeItems();

    if (filtered.length === 0) {
        list.innerHTML = `<div class="empty-msg">No matching items found. Try clearing your search/filters or tap + to add one.</div>`;
        return;
    }
    list.innerHTML = filtered.map(item => generateItemHtml(item, wardrobe.indexOf(item), 'wardrobe')).join('');
}

function renderLaundryLists() {
    const needsWash = document.getElementById('needsWashList');
    const rewearable = document.getElementById('rewearableList');
    const washAllBtn = document.getElementById('washAllBtn');

    const scopedWardrobe = getFilteredByLocation(wardrobe);
    const washItems = scopedWardrobe.filter(i => i.inLaundry || i.wears >= i.threshold);
    const rewearItems = scopedWardrobe.filter(i => !i.inLaundry && i.wears > 0 && i.wears < i.threshold);

    washAllBtn.style.display = washItems.length > 1 ? 'inline-block' : 'none';

    needsWash.innerHTML = washItems.map(item => generateItemHtml(item, wardrobe.indexOf(item), 'laundry')).join('')
        || '<div class="empty-msg">Basket is empty! Everything is clean.</div>';

    rewearable.innerHTML = rewearItems.map(item => generateItemHtml(item, wardrobe.indexOf(item), 'wardrobe')).join('')
        || '<div class="empty-msg">No semi-worn items currently on rotation.</div>';
}

function renderInsights() {
    const overview = document.getElementById('overviewStats');
    const locStats = document.getElementById('locationStats');
    const catContainer = document.getElementById('categoryAnalytics');
    const topBottom = document.getElementById('topBottomAnalytics');

    if (wardrobe.length === 0) {
        overview.innerHTML = '';
        locStats.innerHTML = '';
        catContainer.innerHTML = '<div class="empty-msg">Add items and log wears to view analytics.</div>';
        topBottom.innerHTML = '';
        return;
    }

    const totalLifetimeWears = wardrobe.reduce((sum, i) => sum + (i.totalWears || 0), 0);
    const cleanCount = wardrobe.filter(i => !i.inLaundry && i.wears < i.threshold).length;

    overview.innerHTML = `
        <div class="stat-box"><div class="stat-num">${wardrobe.length}</div><div class="stat-label">Total Items</div></div>
        <div class="stat-box"><div class="stat-num">${cleanCount}</div><div class="stat-label">Clean & Ready</div></div>
        <div class="stat-box"><div class="stat-num">${totalLifetimeWears}</div><div class="stat-label">Lifetime Wears</div></div>
    `;

    locStats.innerHTML = locations.map(loc => {
        const count = wardrobe.filter(i => (i.location || 'Hostel') === loc).length;
        return `<div class="stat-box"><div class="stat-num">${count}</div><div class="stat-label">📍 At ${loc}</div></div>`;
    }).join('');

    catContainer.innerHTML = categories.map(cat => {
        const items = wardrobe.filter(i => i.category === cat.name);
        const wears = items.reduce((s, i) => s + (i.totalWears || 0), 0);
        const pct = totalLifetimeWears > 0 ? Math.round((wears / totalLifetimeWears) * 100) : 0;
        return `
            <div class="cat-bar-row">
                <div class="cat-bar-header">
                    <span><b>${cat.name}</b> (${items.length} items)</span>
                    <span>${wears} wears (${pct}%)</span>
                </div>
                <div class="progress-bar"><div class="progress-fill" style="width:${pct}%; background:var(--accent-primary);"></div></div>
            </div>
        `;
    }).join('');

    const sorted = [...wardrobe].sort((a, b) => (b.totalWears || 0) - (a.totalWears || 0));
    const mostWorn = sorted.slice(0, 3);
    const leastWorn = [...sorted].reverse().slice(0, 3);

    topBottom.innerHTML = `
        <div style="margin-bottom:12px;">
            <div class="analytics-section-title" style="color:var(--accent-secondary);">MOST WORN</div>
            ${mostWorn.map(i => `<div class="analytics-item">• <b>${i.name}</b> (${i.category} • 📍 ${i.location || 'Hostel'}) — ${i.totalWears || 0} wears</div>`).join('')}
        </div>
        <div>
            <div class="analytics-section-title" style="color:var(--warning);">LEAST WORN / UNTOUCHED</div>
            ${leastWorn.map(i => `<div class="analytics-item">• <b>${i.name}</b> (${i.category} • 📍 ${i.location || 'Hostel'}) — ${i.totalWears || 0} wears</div>`).join('')}
        </div>
    `;
}

function updateStorageMeter() {
    const str = JSON.stringify(wardrobe) + JSON.stringify(activityLog) + JSON.stringify(presets);
    const kb = (new Blob([str]).size / 1024).toFixed(1);
    document.getElementById('storageMeter').innerText = `Local Storage Used: ${kb} KB / 5,000 KB`;
}

function exportData() {
    const data = { wardrobe, activityLog, presets, laundryPrefs, categories, locations };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'wardrobetrack_v4_backup.json';
    a.click();
}

function importData(input) {
    if (!input.files || !input.files[0]) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const parsed = JSON.parse(e.target.result);
            if (parsed.wardrobe) wardrobe = parsed.wardrobe;
            if (parsed.activityLog) activityLog = parsed.activityLog;
            if (parsed.presets) presets = parsed.presets;
            if (parsed.laundryPrefs) laundryPrefs = parsed.laundryPrefs;
            if (parsed.categories) categories = parsed.categories;
            if (parsed.locations) locations = parsed.locations;
            localStorage.setItem('wardrobe_laundry_prefs', JSON.stringify(laundryPrefs));
            saveData();
            alert('Backup restored successfully!');
        } catch (err) {
            alert('Invalid backup JSON file.');
        }
    };
    reader.readAsText(input.files[0]);
}

updateUI();
