/* 트래블링구얼 v2.1 여행 준비 체크리스트
 * 신규 기능만 관리. 기존 회화/TTS/북마크/광고 코드를 변경하지 않음.
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'tb_packing_v1';
  const GROUPS = [
    { id: 'documents', name: '필수 서류 · 결제', items: [
      ['passport', '여권 및 유효기간 확인'],
      ['ticket', '항공권 · e-티켓'],
      ['hotel', '숙소 예약 확인서'],
      ['money', '해외결제 카드 · 현금'],
      ['insurance', '여행자보험'],
      ['entry', '입국 요건 · 비자 확인']
    ] },
    { id: 'electronics', name: '전자기기', items: [
      ['phone', '휴대폰 · 충전기'],
      ['battery', '보조배터리 (기내 반입)'],
      ['cable', '충전 케이블'],
      ['adapter', '멀티 어댑터 (돼지코)'],
      ['sim', 'eSIM · 유심 · 유심핀'],
      ['earphones', '이어폰']
    ] },
    { id: 'health', name: '상비약 · 위생', items: [
      ['medication', '개인 복용약'],
      ['cold', '종합감기약 · 진통제'],
      ['stomach', '소화제 · 지사제'],
      ['firstaid', '밴드 · 간단한 구급용품'],
      ['toiletry', '칫솔 · 치약 · 세면도구'],
      ['sunscreen', '선크림 · 개인 위생용품']
    ] },
    { id: 'clothing', name: '의류 · 여행용품', items: [
      ['underwear', '속옷 · 양말'],
      ['clothes', '상의 · 하의'],
      ['coat', '계절에 맞는 외투'],
      ['shoes', '편한 운동화'],
      ['sleepwear', '잠옷 · 실내복'],
      ['umbrella', '접이식 우산'],
      ['bag', '가벼운 보조가방']
    ] }
  ];
  const DEFAULT_TOTAL = GROUPS.reduce((n, group) => n + group.items.length, 0);
  const DEFAULT_IDS = new Set(GROUPS.flatMap(group => group.items.map(item => item[0])));
  let nextId = 1;

  function cleanSavedState() {
    const defaults = { tripName: '', departure: '', checkedIds: [], customItems: [], hideCompleted: false };
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaults;
      const s = JSON.parse(raw);
      if (!s || typeof s !== 'object') return defaults;
      const customItems = Array.isArray(s.customItems) ? s.customItems.filter(item =>
        item && typeof item.id === 'string' && item.id.startsWith('custom-') &&
        typeof item.name === 'string' && item.name.trim().length > 0
      ).map(item => ({id: item.id, name: item.name.slice(0, 70)})).slice(0, 200) : [];
      const validIds = new Set([...DEFAULT_IDS, ...customItems.map(item => item.id)]);
      const checkedIds = Array.isArray(s.checkedIds) ? [...new Set(s.checkedIds.filter(id => typeof id === 'string' && validIds.has(id)))] : [];
      return {
        tripName: typeof s.tripName === 'string' ? s.tripName.slice(0, 60) : '',
        departure: typeof s.departure === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.departure) ? s.departure : '',
        checkedIds, customItems,
        hideCompleted: s.hideCompleted === true
      };
    } catch (error) {
      console.warn('체크리스트 저장 데이터 읽기 실패:', error);
      return defaults;
    }
  }

  let state = cleanSavedState();
  const byId = id => document.getElementById(id);
  const groupsEl = byId('packingGroups');
  const customEl = byId('packingCustomItems');
  if (!groupsEl || !customEl) return;

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn('체크리스트 자동 저장 실패:', error);
      const el = byId('packingSaveWarning');
      if (el) { el.hidden = false; el.classList.remove('hidden'); }
    }
  }

  function createItemRow(id, name, isCustom) {
    const row = document.createElement('div');
    row.className = 'packing-item-row flex items-center gap-2 py-2.5 border-b border-slate-100 last:border-b-0';
    row.dataset.packingId = id;
    const label = document.createElement('label');
    label.className = 'flex flex-1 gap-3 items-center cursor-pointer min-w-0';
    const check = document.createElement('input');
    check.type = 'checkbox';
    check.className = 'packing-checkbox shrink-0 w-5 h-5 accent-blue-600';
    check.checked = state.checkedIds.includes(id);
    check.addEventListener('change', () => {
      if (check.checked && !state.checkedIds.includes(id)) state.checkedIds.push(id);
      if (!check.checked) state.checkedIds = state.checkedIds.filter(x => x !== id);
      save();
      updateVisuals();
    });
    const caption = document.createElement('span');
    caption.className = 'packing-item-text text-[16px] leading-relaxed text-slate-800 break-words';
    caption.textContent = name; // 사용자 추가 항목은 HTML 코드로 해석하지 않음
    label.append(check, caption);
    row.appendChild(label);
    if (isCustom) {
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'shrink-0 text-[14px] text-red-600 px-2 py-1';
      remove.textContent = '삭제';
      remove.setAttribute('aria-label', name + ' 삭제');
      remove.addEventListener('click', () => {
        if (!window.confirm('이 준비물을 삭제할까요?')) return;
        state.customItems = state.customItems.filter(x => x.id !== id);
        state.checkedIds = state.checkedIds.filter(x => x !== id);
        save();
        renderCustom();
        updateVisuals();
      });
      row.appendChild(remove);
    }
    return row;
  }

  function renderGroups() {
    GROUPS.forEach((group, index) => {
      const details = document.createElement('details');
      details.className = 'bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden';
      details.open = index === 0;
      const summary = document.createElement('summary');
      summary.className = 'cursor-pointer select-none p-4 font-bold text-[16px] text-slate-900';
      summary.append(document.createTextNode(group.name + '  '));
      const count = document.createElement('span');
      count.id = 'packingCount_' + group.id;
      count.className = 'text-[14px] font-medium text-blue-600 ml-1';
      summary.appendChild(count);
      const content = document.createElement('div');
      content.className = 'px-4 pb-3 border-t border-slate-100';
      group.items.forEach(([id, name]) => content.appendChild(createItemRow(id, name, false)));
      details.append(summary, content);
      groupsEl.appendChild(details);
    });
  }

  function renderCustom() {
    customEl.replaceChildren();
    state.customItems.forEach(item => customEl.appendChild(createItemRow(item.id, item.name, true)));
  }

  function updateDday() {
    const target = byId('packingDday');
    if (!state.departure) {
      target.textContent = '출발일을 선택하면 D-day가 표시됩니다.';
      return;
    }
    const [year, month, day] = state.departure.split('-').map(Number);
    const validDate = new Date(year, month - 1, day);
    if (validDate.getFullYear() !== year || validDate.getMonth() !== month - 1 || validDate.getDate() !== day) {
      target.textContent = '유효한 출발일을 선택하세요.';
      return;
    }
    const today = new Date();
    const dayDiff = Math.round((Date.UTC(year, month - 1, day) - Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000);
    target.textContent = dayDiff > 0 ? '출발까지 D-' + dayDiff : dayDiff === 0 ? '오늘 출발! D-DAY' : '출발일이 ' + Math.abs(dayDiff) + '일 지났습니다.';
  }

  function updateVisuals() {
    const checked = new Set(state.checkedIds);
    document.querySelectorAll('.packing-item-row').forEach(row => {
      const isDone = checked.has(row.dataset.packingId);
      row.querySelector('.packing-checkbox').checked = isDone;
      row.querySelector('.packing-item-text').classList.toggle('line-through', isDone);
      row.querySelector('.packing-item-text').classList.toggle('text-slate-400', isDone);
      row.hidden = state.hideCompleted && isDone;
      row.classList.toggle('hidden', state.hideCompleted && isDone);
    });
    GROUPS.forEach(group => {
      const count = group.items.filter(item => checked.has(item[0])).length;
      byId('packingCount_' + group.id).textContent = '(' + count + '/' + group.items.length + ')';
    });
    const total = DEFAULT_TOTAL + state.customItems.length;
    const finished = state.checkedIds.length;
    const percent = total > 0 ? Math.round(finished * 100 / total) : 0;
    byId('packingPercent').textContent = percent + '%';
    byId('packingSummary').textContent = finished + ' / ' + total + '개 완료 · ' + (total - finished) + '개 남음';
    byId('packingProgressBar').style.width = percent + '%';
    byId('packingProgress').setAttribute('aria-valuenow', String(percent));
  }

  // 화면 이력은 '기본 회화 → 여행 준비/북마크' 한 단계만 유지한다.
  // 카테고리는 필터이므로 history에 쌓지 않는다.
  let currentSection = 'conversation';
  function showSection(section) {
    const packing = section === 'packing';
    const favorites = section === 'favorites';
    currentSection = section;
    const talk = byId('conversationSection');
    const pack = byId('packingSection');
    talk.hidden = packing;
    pack.hidden = !packing;
    talk.classList.toggle('hidden', packing);
    pack.classList.toggle('hidden', !packing);
    const talkTab = byId('tabConversation');
    const packTab = byId('tabPacking');
    talkTab.setAttribute('aria-selected', String(!packing));
    packTab.setAttribute('aria-selected', String(packing));
    [talkTab, packTab].forEach((tab, idx) => {
      const active = idx === (packing ? 1 : 0);
      tab.classList.toggle('bg-blue-600', active);
      tab.classList.toggle('text-white', active);
      tab.classList.toggle('text-slate-600', !active);
    });
    byId('toggleModeBtn').classList.toggle('hidden', packing);
    // 전체 북마크 보기 상태는 기존 카테고리를 변경하지 않는다.
    if (typeof window.setTravelingualFavoriteView === 'function') {
      // 북마크 표시 여부가 바뀔 때만 문장 목록을 다시 그린다.
      if (window.TravelingualNavigation.favoriteVisible !== favorites) {
        window.setTravelingualFavoriteView(favorites);
        window.TravelingualNavigation.favoriteVisible = favorites;
      }
    }
    window.scrollTo(0, 0);
  }

  function navState(section) {
    return { ...(history.state || {}), travelingualSection: section };
  }

  // 다른 보조 화면에서 다른 보조 화면으로 이동할 때는 이력을 새로 쌓지 않는다.
  function open(section) {
    if (section === currentSection) return;
    if (section === 'conversation') { closeToConversation(); return; }
    if (section !== 'packing' && section !== 'favorites') return;
    if (currentSection === 'conversation') {
      history.pushState(navState(section), '', location.href);
    } else {
      history.replaceState(navState(section), '', location.href);
    }
    showSection(section);
  }

  function closeToConversation() {
    if (currentSection === 'conversation') return false;
    // 즉시 화면은 복귀시키고, 원래 기본 화면으로 popstate를 통해 이력을 정리한다.
    showSection('conversation');
    if (history.state?.travelingualSection !== 'conversation') {
      history.back();
    }
    return true;
  }

  // Android 최신 앱은 보조 화면을 먼저 닫고, 기본 화면은 2회 뒤로가기로 종료한다.
  // 기존 설치 앱은 WebView.goBack()과 popstate만으로 동일한 보조 화면 복귀가 가능하다.
  window.TravelingualNavigation = {
    favoriteVisible: false,
    open,
    closeToConversation,
    handleAndroidBack() { return closeToConversation(); }
  };

  const initialSection = ['packing', 'favorites'].includes(history.state?.travelingualSection)
    ? history.state.travelingualSection : 'conversation';
  if (!history.state || !history.state.travelingualSection) {
    history.replaceState(navState('conversation'), '', location.href);
  }
  byId('tabConversation').addEventListener('click', () => open('conversation'));
  byId('tabPacking').addEventListener('click', () => open('packing'));
  window.addEventListener('popstate', event => {
    const section = ['packing', 'favorites'].includes(event.state?.travelingualSection)
      ? event.state.travelingualSection : 'conversation';
    showSection(section);
  });

  byId('packingTripName').value = state.tripName;
  byId('packingDeparture').value = state.departure;
  byId('packingHideDone').checked = state.hideCompleted;
  byId('packingTripName').addEventListener('input', event => { state.tripName = event.target.value; save(); });
  byId('packingDeparture').addEventListener('change', event => { state.departure = event.target.value; save(); updateDday(); });
  byId('packingHideDone').addEventListener('change', event => { state.hideCompleted = event.target.checked; save(); updateVisuals(); });
  byId('packingAddForm').addEventListener('submit', event => {
    event.preventDefault();
    const input = byId('packingNewItem');
    const name = input.value.trim();
    if (!name) return;
    if (GROUPS.some(group => group.items.some(item => item[1] === name)) || state.customItems.some(item => item.name === name)) {
      if (typeof window.showToast === 'function') window.showToast('이미 목록에 있는 준비물입니다.');
      return;
    }
    state.customItems.push({id: 'custom-' + Date.now() + '-' + nextId++, name});
    input.value = '';
    save();
    renderCustom();
    updateVisuals();
  });
  byId('packingResetBtn').addEventListener('click', () => {
    if (!window.confirm('모든 완료 체크를 초기화할까요? 추가한 준비물과 여행 정보는 유지됩니다.')) return;
    state.checkedIds = [];
    save();
    updateVisuals();
  });

  renderGroups();
  renderCustom();
  updateVisuals();
  updateDday();
  showSection(initialSection, false);
})();
