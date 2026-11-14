/** The boundary a pointer at `y` means among rows whose vertical middles are `middles` (ascending): the index of the
 *  first row whose middle is below the pointer, or their number when none is. The midpoint rule of every drop and tap
 *  (ADR-095); a binary search, for a pointer move asks it on every event (ADR-155, T1.3). */
export function boundaryAt(middles, y) {
    let low = 0, high = middles.length;
    while (low < high) {
        const middle = (low + high) >> 1;
        if (y < middles[middle])
            high = middle;
        else
            low = middle + 1;
    }
    return low;
}
export function createInsertionDrag({ root, onInsert, onReturn, onPick }) {
    let drag = null, previewZone = null, previewBoundary = null;
    const clear = () => {
        // Only the rows that carry a preview class: nothing else has one to lose (ADR-155, T1.4).
        root.querySelectorAll('.code-row.drop-shift,.code-row.drop-prev').forEach(row => row.classList.remove('drop-shift', 'drop-prev'));
        root.querySelectorAll('.drop-zone.over').forEach(zone => zone.classList.remove('over'));
        root.querySelectorAll('.insert-caret').forEach(el => el.remove());
        previewZone = null;
        previewBoundary = null;
    };
    const rowsOf = (zone) => [...zone.querySelectorAll(':scope > .code-row')];
    /** ADR-155 (T1.3): where the rows of a list stand, measured once for as long as the list is the same element at the
     *  same width: every redraw makes new lists, and a width change can wrap nothing here but may change the rows'
     *  height with the pointer's kind. In the list's own content coordinates, so neither its scrolling nor the
     *  preview's shift of the rows (a transform) changes them. */
    const measured = new WeakMap();
    const middlesOf = (zone) => {
        const known = measured.get(zone), width = zone.clientWidth;
        if (known && known.width === width)
            return known.middles;
        const middles = rowsOf(zone).map(row => row.offsetTop + row.offsetHeight / 2);
        measured.set(zone, { width, middles });
        return middles;
    };
    const position = (zone, event) => boundaryAt(middlesOf(zone), event.clientY - zone.getBoundingClientRect().top - zone.clientTop + zone.scrollTop);
    const preview = (zone, boundary) => {
        if (previewZone === zone && previewBoundary === boundary)
            return;
        // ADR-155 (T1.4): within one list only the rows between the old boundary and the new one change; marking every row
        // after the boundary again on each step restyled the whole list (44-66 ms of a key press on 482 rows).
        const same = previewZone === zone, from = same ? previewBoundary : null;
        if (same)
            root.querySelectorAll('.insert-caret').forEach(el => el.remove());
        else {
            clear();
            zone.classList.add('over');
        }
        previewZone = zone;
        previewBoundary = boundary;
        if (zone.dataset.zone !== 'answer')
            return;
        const rows = rowsOf(zone), before = from ?? rows.length;
        for (let i = Math.min(before, boundary); i < Math.max(before, boundary); i++)
            rows[i]?.classList.toggle('drop-shift', i >= boundary);
        if (from !== null && from > 0)
            rows[from - 1]?.classList.remove('drop-prev');
        if (boundary > 0)
            rows[boundary - 1].classList.add('drop-prev');
        const anchor = rows[boundary], last = rows.at(-1);
        const z = zone.getBoundingClientRect();
        const top = anchor ? anchor.getBoundingClientRect().top - z.top + zone.scrollTop - 8 :
            last ? last.getBoundingClientRect().bottom - z.top + zone.scrollTop + 8 : 8;
        const caret = document.createElement('div');
        caret.className = 'insert-caret';
        caret.style.top = `${Math.max(0, top)}px`;
        caret.setAttribute('aria-hidden', 'true');
        zone.append(caret);
    };
    const element = (target) => target instanceof Element ? target : null;
    const announce = (message) => { const live = root.querySelector('[data-move-status]'); if (live)
        live.textContent = message; };
    const infoFor = (node) => ({ from: node.dataset.list, index: Number(node.dataset.index), id: node.dataset.lineId, exercise: root.dataset.renderedExercise });
    const finish = (info, boundary, back = false) => {
        if (info.exercise !== root.dataset.renderedExercise)
            return;
        if (back)
            onReturn(info.index);
        else
            onInsert(info, boundary);
        const row = [...root.querySelectorAll('.code-row')].find(x => x.dataset.lineId === info.id && x.dataset.list === (back ? 'pool' : 'answer'));
        row?.querySelector('.drag-handle')?.focus({ preventScroll: true });
        announce(row ? `Sor áthelyezve: ${Number(row.dataset.index) + 1}. pozíció.` : 'A sor nem mozgatható erre a helyre.');
    };
    let keyboard = null, pointer = null, animation = null, picked = null;
    const unpick = () => { const had = picked !== null; picked = null; root.querySelectorAll('.code-row.picked').forEach(row => row.classList.remove('picked')); root.querySelectorAll('.drop-zone.tap-target').forEach(zone => zone.classList.remove('tap-target')); if (had)
        onPick?.(null); };
    const pickRow = (node) => {
        unpick();
        picked = infoFor(node);
        node.classList.add('picked');
        root.querySelectorAll('.drop-zone[data-zone]').forEach(z => z.classList.add('tap-target'));
        // The view redraws on a pick (its live region too), so the announcement follows it.
        onPick?.(picked);
        announce('Sor kijelölve. Koppints a helyére: egy üres helyre, egy sor elé vagy mögé, vagy válassz a lenti műveletekből. A fogantyúra újra koppintva megszünteted.');
    };
    /** The picked row where it is now: a move through the action bar changes its index, never its line id. */
    const current = (info) => { const node = [...root.querySelectorAll('.code-row')].find(x => x.dataset.lineId === info.id && x.dataset.list === info.from); return node ? { ...info, index: Number(node.dataset.index) } : info; };
    const cancelPointer = () => {
        if (animation !== null)
            cancelAnimationFrame(animation);
        animation = null;
        if (pointer && drag === pointer)
            drag = null;
        pointer = null;
        clear();
    };
    /** ADR-095: the tapped place for the picked row: an empty slot is filled, a row splits at its midpoint, the pool takes a solution row back. */
    const place = (picks, zone, event, row) => {
        const info = current(picks);
        unpick();
        if (zone.dataset.zone === 'answer')
            finish(info, row?.classList.contains('blank-row') ? Number(row.dataset.index) : position(zone, event));
        else if (info.from === 'answer')
            finish(info, 0, true);
        else
            announce('A sor már a felhasználható sorok között van.');
    };
    root.addEventListener('dragstart', ev => {
        const node = element(ev.target)?.closest('.code-row');
        if (!node || node.draggable !== true)
            return;
        // Native HTML drag takes ownership; its browser-generated pointercancel
        // must never erase the new native drag session.
        keyboard = null;
        unpick();
        cancelPointer();
        drag = infoFor(node);
        ev.dataTransfer?.setData('text/plain', 'ngdynamic-code-line');
        if (ev.dataTransfer)
            ev.dataTransfer.effectAllowed = 'move';
    });
    root.addEventListener('dragover', ev => {
        if (!drag)
            return;
        const zone = element(ev.target)?.closest('.drop-zone');
        if (!zone)
            return;
        ev.preventDefault();
        if (ev.dataTransfer)
            ev.dataTransfer.dropEffect = 'move';
        const box = zone.getBoundingClientRect();
        // Autoscroll long editors near their top/bottom edge.
        if (ev.clientY > box.bottom - 27)
            zone.scrollTop += 16;
        else if (ev.clientY < box.top + 27)
            zone.scrollTop -= 16;
        preview(zone, position(zone, ev));
    });
    root.addEventListener('drop', ev => {
        if (!drag)
            return;
        const zone = element(ev.target)?.closest('.drop-zone');
        if (!zone) {
            clear();
            drag = null;
            return;
        }
        ev.preventDefault();
        const info = drag, boundary = position(zone, ev);
        clear();
        drag = null;
        if (info.exercise !== root.dataset.renderedExercise)
            return;
        if (zone.dataset.zone === 'answer')
            finish(info, boundary);
        else if (info.from === 'answer')
            finish(info, 0, true);
    });
    root.addEventListener('dragend', () => { drag = null; clear(); });
    const tick = () => {
        if (!pointer?.moving)
            return;
        const zone = document.elementFromPoint(pointer.x, pointer.y)?.closest('.drop-zone');
        if (zone) {
            const box = zone.getBoundingClientRect();
            if (pointer.y < box.top + 27)
                zone.scrollTop -= 12;
            else if (pointer.y > box.bottom - 27)
                zone.scrollTop += 12;
            preview(zone, position(zone, { clientY: pointer.y }));
        }
        animation = requestAnimationFrame(tick);
    };
    root.addEventListener('pointerdown', ev => {
        const handle = element(ev.target)?.closest('.drag-handle'), row = handle?.closest('.code-row');
        if (!handle || !row || row.draggable !== true || ev.button !== 0)
            return;
        ev.preventDefault();
        handle.focus({ preventScroll: true });
        keyboard = null;
        pointer = { ...infoFor(row), pointerId: ev.pointerId, pointerType: ev.pointerType, startX: ev.clientX, startY: ev.clientY, x: ev.clientX, y: ev.clientY, moving: false };
        try {
            root.setPointerCapture(ev.pointerId);
        }
        catch { }
    });
    root.addEventListener('pointermove', ev => {
        if (!pointer || pointer.pointerId !== ev.pointerId)
            return;
        pointer.x = ev.clientX;
        pointer.y = ev.clientY;
        if (!pointer.moving && Math.hypot(pointer.x - pointer.startX, pointer.y - pointer.startY) > 4) {
            pointer.moving = true;
            unpick();
            drag = pointer;
            tick();
        }
    });
    root.addEventListener('pointerup', ev => {
        if (!pointer || pointer.pointerId !== ev.pointerId)
            return;
        const info = pointer, hit = document.elementFromPoint(ev.clientX, ev.clientY), zone = hit?.closest('.drop-zone') ?? null;
        const boundary = zone ? position(zone, ev) : null;
        cancelPointer();
        try {
            root.releasePointerCapture(ev.pointerId);
        }
        catch { }
        if (!info.moving) {
            // ADR-095: a touch or pen tap on a handle picks its row; on the picked handle it cancels; on another row's handle it places there.
            if (info.pointerType !== 'touch' && info.pointerType !== 'pen')
                return;
            if (picked && picked.id === info.id && picked.from === info.from) {
                unpick();
                announce('Kijelölés megszüntetve.');
                return;
            }
            if (picked && zone && !(zone.dataset.zone === 'pool' && picked.from === 'pool')) {
                place(picked, zone, ev, hit?.closest('.code-row') ?? null);
                return;
            }
            const node = root.querySelector(`.code-row[data-list="${CSS.escape(info.from ?? '')}"][data-index="${info.index}"]`);
            if (node)
                pickRow(node);
            return;
        }
        if (!zone || boundary === null)
            return;
        if (zone.dataset.zone === 'answer')
            finish(info, boundary);
        else if (info.from === 'answer')
            finish(info, 0, true);
    });
    // ADR-095: the place tap. Buttons keep their own action (and end the pick); the handle's own taps are handled on pointerup.
    root.addEventListener('click', ev => {
        const target = element(ev.target);
        if (!picked) {
            // ADR-118: a touch or pen tap on a movable row's code picks it, as a tap on its handle does. On a touch-first screen
            // (hover: none, the stylesheet's condition for hiding the row controls) a mouse click picks it too, so a mouse on a
            // tablet still reaches the row's actions.
            const kind = ev.pointerType, row = target?.closest('.drop-zone[data-zone] .code-row');
            const touchFirst = kind === 'touch' || kind === 'pen' || (typeof matchMedia === 'function' && matchMedia('(hover: none)').matches);
            if (touchFirst && row && row.draggable === true && !target.closest('button,a,input,select,textarea,summary'))
                pickRow(row);
            return;
        }
        // The event's own path, fixed at dispatch: a handler that redraws first (the action bar) leaves `target` detached.
        const path = ev.composedPath().filter((node) => node instanceof Element), on = (selector) => path.some(node => node.matches(selector));
        if (!target || on('.drag-handle'))
            return;
        if (on('[data-keep-pick]'))
            return;
        if (on('button,a,input,select,textarea,summary')) {
            unpick();
            return;
        }
        const zone = target.closest('.drop-zone[data-zone]');
        if (!zone) {
            unpick();
            announce('Kijelölés megszüntetve.');
            return;
        }
        if (picked.exercise !== root.dataset.renderedExercise) {
            unpick();
            return;
        }
        place(picked, zone, ev, target.closest('.code-row'));
    });
    root.addEventListener('pointercancel', ev => {
        // Native dragging intentionally cancels the browser pointer stream. Only
        // cancel a custom pointer gesture when this adapter owns that pointer ID.
        if (pointer?.pointerId === ev.pointerId)
            cancelPointer();
    });
    root.addEventListener('keydown', ev => {
        if (ev.key === 'Escape') {
            keyboard = null;
            drag = null;
            unpick();
            cancelPointer();
            announce('Mozgatás megszakítva.');
            return;
        }
        const handle = element(ev.target)?.closest('.drag-handle'), row = handle?.closest('.code-row');
        if (!row || row.draggable !== true)
            return;
        if (![' ', 'Enter', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(ev.key))
            return;
        ev.preventDefault();
        if (!keyboard) {
            if (ev.key !== ' ' && ev.key !== 'Enter')
                return;
            unpick();
            keyboard = { ...infoFor(row), boundary: row.dataset.list === 'answer' ? Number(row.dataset.index) : 0 };
            announce('Sor felvéve. Nyilak: beszúrási hely. Enter: elhelyezés. Escape: megszakítás.');
        }
        else if (ev.key === ' ' || ev.key === 'Enter') {
            const info = keyboard;
            keyboard = null;
            clear();
            finish(info, info.boundary);
            return;
        }
        else {
            const zone = root.querySelector('.solution-zone');
            if (!zone)
                return;
            const length = rowsOf(zone).length;
            keyboard.boundary = ev.key === 'Home' ? 0 : ev.key === 'End' ? length : Math.max(0, Math.min(length, keyboard.boundary + (ev.key === 'ArrowUp' ? -1 : 1)));
            preview(zone, keyboard.boundary);
            announce(`Beszúrási határ: ${keyboard.boundary}.`);
        }
    });
    return { clear: () => { keyboard = null; drag = null; unpick(); cancelPointer(); } };
}
