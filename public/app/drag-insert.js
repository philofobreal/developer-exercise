export function createInsertionDrag({ root, onInsert, onReturn, onPick }) {
    let drag = null, previewZone = null, previewBoundary = null;
    const clear = () => {
        root.querySelectorAll('.drop-zone .code-row').forEach(row => row.classList.remove('drop-shift', 'drop-prev'));
        root.querySelectorAll('.drop-zone').forEach(zone => zone.classList.remove('over'));
        root.querySelectorAll('.insert-caret').forEach(el => el.remove());
        previewZone = null;
        previewBoundary = null;
    };
    const rowsOf = (zone) => [...zone.querySelectorAll(':scope > .code-row')];
    const position = (zone, event) => {
        const rows = rowsOf(zone);
        if (!rows.length)
            return 0;
        const y = event.clientY;
        for (let i = 0; i < rows.length; i++) {
            const r = rows[i], rect = r.getBoundingClientRect();
            const cssTransform = getComputedStyle(r).transform;
            const transform = cssTransform === 'none' ? 0 : new DOMMatrixReadOnly(cssTransform).m42;
            if (y < rect.top - transform + rect.height / 2)
                return i;
        }
        return rows.length;
    };
    const preview = (zone, boundary) => {
        if (previewZone === zone && previewBoundary === boundary)
            return;
        clear();
        previewZone = zone;
        previewBoundary = boundary;
        zone.classList.add('over');
        if (zone.dataset.zone !== 'answer')
            return;
        const rows = rowsOf(zone);
        rows.slice(boundary).forEach(row => row.classList.add('drop-shift'));
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
        if (!target || target.closest('.drag-handle'))
            return;
        if (target.closest('[data-keep-pick]'))
            return;
        if (target.closest('button,a,input,select,textarea,summary')) {
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
