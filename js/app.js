/* ═══════════════════════════════════════════════════════════
   app.js — NMC Website Main Application Logic
   ═══════════════════════════════════════════════════════════

   Sections (Ctrl+F to jump):
     1. MODAL          — Enlistment modal open / close / submit
     2. GALLERY        — Lightbox open/close
     3. SUPABASE       — Client init, waitForSupabase
     4. STATS          — Guild stats fetch + realtime
     5. LEADERBOARDS   — Fetch + render + realtime
     6. GALLERY LOAD   — Load media from Supabase
     7. PARTNERS       — Load partner cards from Supabase
     8. MEMBERS        — Load officers from Supabase
     9. UTILS          — animateRealValue, scroll reveal, nav
   ═══════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', function () {

    /* ─── 1. MODAL ──────────────────────────────────────────── */

    function openEnlistModal() {
        document.getElementById('enlistModal').classList.add('active');
        document.body.style.overflow = 'hidden';
    }
    window.openEnlistModal = openEnlistModal;

    function closeEnlistModal() {
        document.getElementById('enlistModal').classList.remove('active');
        document.body.style.overflow = '';
    }
    window.closeEnlistModal = closeEnlistModal;

    async function submitApplication(e) {
        e.preventDefault();
        const btn = document.getElementById('enlistSubmitBtn');
        btn.disabled = true;
        btn.textContent = 'Submitting...';

        const username  = document.getElementById('f-username').value.trim();
        const active    = document.getElementById('f-active').value;
        const loyal     = document.getElementById('f-loyal').value;
        const intro     = document.getElementById('f-intro').value.trim();
        const better    = document.getElementById('f-better').value.trim();
        const whyNMC    = document.getElementById('f-whynmc').value.trim();
        const authority = document.getElementById('f-authority').value;

        const webhookUrl = 'https://discord.com/api/webhooks/1476223568780988651/d5CFOWcR48_ezrYDVeyElh3b-1wbuGgidHhe4KiL9YilXg7NN-8P1Z5kKA2TZhx6gmSj';

        const payload = {
            embeds: [{
                title: 'New Enlistment Application (Website)',
                color: 0x00ff00,
                author: { name: username },
                fields: [
                    { name: '1. Will you be active?',                       value: active,              inline: true },
                    { name: '2. Will you be loyal and obey the Commander?', value: loyal,               inline: true },
                    { name: '3. Introduction',                              value: intro     || '*No answer*' },
                    { name: '4. What makes you better?',                   value: better    || '*No answer*' },
                    { name: '5. Why NMC?',                                  value: whyNMC    || '*No answer*' },
                    { name: '6. Accepts Commander Authority?',              value: authority || '*No answer*' },
                ],
                timestamp: new Date().toISOString()
            }]
        };

        try {
            const res = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok || res.status === 204) {
                btn.textContent = '✅ Submitted! Redirecting to Discord...';
                btn.style.background = 'linear-gradient(135deg,#22c55e,#16a34a)';
                document.getElementById('enlistForm').reset();
                setTimeout(() => {
                    window.open('https://discord.gg/qwRUQ6msT8', '_blank');
                    closeEnlistModal();
                    btn.disabled = false;
                    btn.textContent = 'Submit Application & Join Discord';
                    btn.style.background = '';
                }, 2000);
            } else {
                throw new Error(`HTTP ${res.status}`);
            }
        } catch (err) {
            console.error('Webhook error:', err);
            btn.disabled = false;
            btn.textContent = 'Submit Application & Join Discord';
            alert('❌ Failed to submit. Please try again or join Discord directly.');
        }
    }
    window.submitApplication = submitApplication;

    // Close modal / driver card on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { closeEnlistModal(); hideDriverCard(); }
    });

    // Close modal when clicking outside the content box
    document.getElementById('enlistModal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('enlistModal')) closeEnlistModal();
    });

    // Refresh gallery when tab becomes visible again
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') loadGallery();
    });


    /* ─── 2. GALLERY (Lightbox) ─────────────────────────────── */

    function openLightbox(url, type, desc) {
        const lb    = document.getElementById('lightbox');
        const img   = document.getElementById('lightbox-img');
        const vid   = document.getElementById('lightbox-vid');
        const ldesc = document.getElementById('lightbox-desc');
        img.classList.remove('active');
        vid.classList.remove('active');
        vid.pause && vid.pause();
        if (type === 'video') {
            vid.src = url; vid.classList.add('active');
        } else {
            img.src = url; img.classList.add('active');
        }
        ldesc.textContent = desc || '';
        lb.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeLightbox() {
        const lb  = document.getElementById('lightbox');
        const vid = document.getElementById('lightbox-vid');
        lb.classList.remove('active');
        vid.pause && vid.pause();
        vid.src = '';
        document.body.style.overflow = '';
    }
    window.closeLightbox = closeLightbox;


    /* ─── 3. SUPABASE ───────────────────────────────────────── */

    const SUPABASE_URL      = 'https://aijrvldtilncnclvvles.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpanJ2bGR0aWxuY25jbHZ2bGVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1MDQ2MjgsImV4cCI6MjA4MTA4MDYyOH0.ASKDuChVVlCzW7cnfUJQ2TbPUx90HPKZ60c6o7-s_AM';
    const TARGET_GUILD_ID   = '1448027116074434593';

    let supabase = null;

    /* Poll for Supabase CDN (loaded async) — up to 6 seconds */
    function waitForSupabase(attempt) {
        if (window.supabase) {
            supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            console.log('[Supabase] CDN ready. Loading data...');
            fetchRealtimeStats();
            subscribeToGuildStats();
            subscribeToMemberAvatars();
            subscribeToLeaderboards();
            subscribeToGalleryUrls();
            loadLeaderboards();
            loadGallery();
            loadPartners();
            loadMembers();
        } else if (attempt < 12) {
            setTimeout(function () { waitForSupabase(attempt + 1); }, 500);
        } else {
            console.warn('[Supabase] CDN failed to load after 6s. Stats will not show.');
        }
    }
    waitForSupabase(0);


    /* ─── 4. STATS ──────────────────────────────────────────── */

    function applyGuildStats(guildData) {
        if (!guildData) return;
        if (guildData.net_worth !== undefined) {
            animateRealValue('stat-net-worth', guildData.net_worth || 0, '', true);
        }
    }

    async function fetchRealtimeStats() {
        if (!supabase) return;
        try {
            // Guild-level stats
            const { data: guildData, error: guildErr } = await supabase
                .from('approved_guilds')
                .select('net_worth')
                .eq('guild_id', TARGET_GUILD_ID)
                .single();

            if (guildErr) console.error('Guild fetch error:', guildErr.message);
            else applyGuildStats(guildData);

            // All player IDs belonging to this guild
            const { data: guildPlayers, error: playersErr } = await supabase
                .from('players')
                .select('id')
                .eq('guild_id', TARGET_GUILD_ID);

            if (playersErr) { console.error('Players fetch error:', playersErr.message); return; }

            const playerIds = (guildPlayers || []).map(p => p.id);
            if (playerIds.length === 0) return;

            // Aggregate km + time across those players
            const { data: statsData, error: statsErr } = await supabase
                .from('player_stats')
                .select('total_distance_km, total_time_minutes')
                .in('player_id', playerIds);

            if (statsErr) { console.error('Stats fetch error:', statsErr.message); return; }

            let totalDistance = 0, totalTimeMins = 0;
            (statsData || []).forEach(s => {
                totalDistance += (s.total_distance_km    || 0);
                totalTimeMins += (s.total_time_minutes   || 0);
            });

            const totalHours = Math.floor(totalTimeMins / 60);
            animateRealValue('stat-miles',        totalDistance, ' km');
            animateRealValue('hero-stat-miles',   totalDistance, ' km');
            animateRealValue('stat-driving-time', totalHours,    ' h');

        } catch (e) {
            console.error('Error fetching realtime stats:', e);
        }
    }

    function subscribeToGuildStats() {
        if (!supabase) return;
        supabase
            .channel('guild_stats_website')
            .on('postgres_changes', {
                event: 'UPDATE', schema: 'public', table: 'approved_guilds',
                filter: 'guild_id=eq.' + TARGET_GUILD_ID
            }, (payload) => {
                console.log('[REALTIME] approved_guilds updated');
                applyGuildStats(payload.new);
            })
            .subscribe();
    }

    function subscribeToMemberAvatars() {
        if (!supabase) return;
        supabase
            .channel('member_avatars_website')
            .on('postgres_changes', {
                event: 'UPDATE', schema: 'public', table: 'website_members'
            }, (payload) => {
                const updated = payload.new;
                if (!updated.discord_id || !updated.photo_url) return;
                const img = document.querySelector('[data-discord-id="' + updated.discord_id + '"] .member-photo');
                if (img) img.src = updated.photo_url;
            })
            .subscribe();
    }

    function subscribeToGalleryUrls() {
        if (!supabase) return;
        supabase
            .channel('media_gallery_website')
            .on('postgres_changes', {
                event: 'UPDATE', schema: 'public', table: 'media_gallery'
            }, (payload) => {
                const updated = payload.new;
                if (!updated.id || !updated.media_url) return;
                const mediaEl = document.querySelector(
                    '[data-media-id="' + updated.id + '"] img, [data-media-id="' + updated.id + '"] video'
                );
                if (mediaEl) {
                    if (mediaEl.tagName === 'VIDEO') {
                        mediaEl.querySelector('source').src = updated.media_url;
                        mediaEl.load();
                    } else {
                        mediaEl.src = updated.media_url;
                    }
                }
            })
            .subscribe();
    }


    /* ─── 5. LEADERBOARDS ───────────────────────────────────── */

    const RANK_CLASS = ['r1', 'r2', 'r3', 'r4', 'r5'];

    function renderLb(listId, rows, valFn) {
        const el = document.getElementById(listId);
        if (!el) return;
        if (!rows || rows.length === 0) {
            el.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:8px 0">No data yet</div>';
            return;
        }
        el.innerHTML = '';
        rows.forEach(function (r, i) {
            const row = document.createElement('div');
            row.className = 'lb-row';
            row.innerHTML =
                '<div class="lb-rank ' + (RANK_CLASS[i] || '') + '">' + (i + 1) + '</div>' +
                '<div class="lb-name">' + (r.username || 'Unknown') + '</div>' +
                '<div class="lb-val">'  + valFn(r) + '</div>';
            el.appendChild(row);
        });
    }

    async function loadLeaderboards() {
        if (!supabase) return;
        try {
            const { data: players, error: pErr } = await supabase
                .from('players')
                .select('id, username, display_name')
                .eq('guild_id', TARGET_GUILD_ID);

            if (pErr || !players || players.length === 0) {
                console.warn('[LB] No NMC players found.');
                ['lb-clean', 'lb-distance', 'lb-time', 'lb-level', 'lb-speed'].forEach(id => renderLb(id, [], null));
                return;
            }

            const ids     = players.map(p => p.id);
            const userMap = {};
            players.forEach(p => { userMap[p.id] = p.display_name || p.username; });

            const queries = [
                supabase.from('player_stats').select('player_id,clean_deliveries')    .in('player_id', ids).order('clean_deliveries',      { ascending: false }).limit(5),
                supabase.from('player_stats').select('player_id,total_distance_km')   .in('player_id', ids).order('total_distance_km',     { ascending: false }).limit(5),
                supabase.from('player_stats').select('player_id,total_time_minutes')  .in('player_id', ids).order('total_time_minutes',    { ascending: false }).limit(5),
                supabase.from('player_stats').select('player_id,current_level')       .in('player_id', ids).order('current_level',         { ascending: false }).limit(5),
                supabase.from('player_stats').select('player_id,best_avg_speed_kmph') .in('player_id', ids).order('best_avg_speed_kmph',   { ascending: false }).limit(5),
            ];

            const results = await Promise.all(queries);
            function attach(data) {
                return (data || []).map(r => Object.assign({}, r, { username: userMap[r.player_id] || 'Unknown' }));
            }

            renderLb('lb-clean',    attach(results[0].data), r => (r.clean_deliveries || 0) + ' runs');
            renderLb('lb-distance', attach(results[1].data), r => Math.round(r.total_distance_km || 0).toLocaleString() + ' km');
            renderLb('lb-time',     attach(results[2].data), r => Math.floor((r.total_time_minutes || 0) / 60).toLocaleString() + ' h');
            renderLb('lb-level',    attach(results[3].data), r => 'Lv. ' + (r.current_level || 1));
            renderLb('lb-speed',    attach(results[4].data), r => (r.best_avg_speed_kmph || 0).toFixed(1) + ' km/h');

        } catch (e) {
            console.error('[LB] Error loading leaderboards:', e);
        }
    }

    function subscribeToLeaderboards() {
        if (!supabase) return;
        supabase
            .channel('leaderboard_realtime')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'player_stats' },
                () => loadLeaderboards())
            .subscribe();
    }


    /* ─── 6. GALLERY LOAD ───────────────────────────────────── */

    async function loadGallery() {
        if (!supabase) return;
        try {
            const { data, error } = await supabase
                .from('media_gallery')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) { console.error('Gallery fetch error:', error.message); return; }
            if (!data || data.length === 0) return;

            const grid  = document.getElementById('gallery-grid');
            if (!grid) return;
            const empty = document.getElementById('gallery-empty');
            empty && empty.remove();

            data.forEach(function (item) {
                const div   = document.createElement('div');
                const isVid = item.media_type === 'video';
                div.className = 'gallery-item';
                div.setAttribute('data-media-id', item.id);
                div.innerHTML =
                    (isVid
                        ? '<video src="' + item.media_url + '" muted loop playsinline></video>' +
                          '<span class="gallery-video-badge">&#9654; VIDEO</span>'
                        : '<img src="' + item.media_url + '" alt="' + (item.description || '') + '" loading="lazy">')
                    + '<div class="gallery-overlay"><span class="gallery-overlay-text">' + (item.description || '') + '</span></div>';
                div.addEventListener('click', () => openLightbox(item.media_url, item.media_type, item.description));
                grid.appendChild(div);
            });
        } catch (e) {
            console.error('Error loading gallery:', e);
        }
    }


    /* ─── 7. PARTNERS ───────────────────────────────────────── */

    async function loadPartners() {
        if (!supabase) return;
        try {
            const { data, error } = await supabase
                .from('partners')
                .select('*')
                .order('created_at', { ascending: true });

            if (error) { console.error('Partners fetch error:', error.message); return; }
            if (!data || data.length === 0) return; // keep placeholder

            const grid = document.getElementById('partners-grid');
            if (!grid) return;
            grid.innerHTML = '';

            data.forEach((p, i) => {
                const delay = i % 3 === 0 ? '' : i % 3 === 1 ? ' reveal-delay-1' : ' reveal-delay-2';
                const card  = document.createElement('div');
                card.className = 'partner-card reveal' + delay;
                card.innerHTML =
                    '<div class="partner-bg" style="background-image:url(\'' + (p.bg_url || '') + '\')"></div>' +
                    '<div class="partner-logo-box">' +
                        (p.logo_url ? '<img src="' + p.logo_url + '" alt="' + p.name + ' logo">' : p.name.charAt(0)) +
                    '</div>' +
                    '<div class="partner-name">' + p.name + '</div>' +
                    '<div class="partner-desc">' + (p.description || '') + '</div>';
                grid.appendChild(card);
            });

            // Trigger reveal for newly added cards
            grid.querySelectorAll('.reveal').forEach(el => observer.observe(el));
        } catch (e) {
            console.error('Error loading partners:', e);
        }
    }


    /* ─── 8. MEMBERS (Officers + Active + Reserved Personnel) ──── */

    function renderPersonnelTable(bodyId, rows, clickable) {
        const tbody = document.getElementById(bodyId);
        if (!tbody) return;
        if (!rows || rows.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="personnel-empty">No personnel listed yet.</td></tr>';
            return;
        }
        tbody.innerHTML = '';
        rows.forEach(function (m, i) {
            const unitText = m.unit_number ? m.unit_number : (i + 1);
            const tr = document.createElement('tr');
            if (clickable && m.discord_id) {
                tr.className = 'clickable-row';
                tr.title = 'Click to view driver stats';
                tr.addEventListener('click', function () { showDriverCard(m); });
            }
            tr.innerHTML =
                '<td class="personnel-rank">' + unitText + '</td>' +
                '<td><img class="personnel-avatar" src="' +
                    (m.photo_url || 'https://cdn.discordapp.com/embed/avatars/0.png') +
                    '" alt="' + m.display_name + '" onerror="this.src=\'https://cdn.discordapp.com/embed/avatars/0.png\'"></td>' +
                '<td class="personnel-name">' + m.display_name + '</td>';
            tbody.appendChild(tr);
        });
    }

    async function loadMembers() {
        if (!supabase) return;
        try {
            // Load Officers
            const { data: officerData, error: officerError } = await supabase
                .from('website_members')
                .select('*')
                .eq('section', 'officer')
                .order('created_at', { ascending: true });

            if (!officerError && officerData) {
                const officersGrid  = document.getElementById('officers-grid');
                const officersEmpty = document.getElementById('officers-empty');
                if (officerData.length > 0 && officersGrid) {
                    officersEmpty && officersEmpty.remove();
                    officerData.forEach(m => {
                        const card = buildMemberCard(m);
                        officersGrid.appendChild(card);
                        observer.observe(card);
                    });
                }
            }

            // Load Enlisted Drivers (Active/Reserved)
            const { data: driverData, error: driverError } = await supabase
                .from('enlisted_drivers')
                .select('*')
                .order('created_at', { ascending: true });
                
            if (!driverError && driverData) {
                const active   = driverData.filter(m => m.status === 'AP');
                const reserved = driverData.filter(m => m.status === 'RP');
                const retired  = driverData
                    .filter(m => m.status === 'RTD')
                    .sort((a, b) => {
                        const na = a.display_name || '', nb = b.display_name || '';
                        return na.length !== nb.length ? na.length - nb.length : na.localeCompare(nb);
                    });

                renderPersonnelTable('active-personnel-body',   active,   true);
                renderPersonnelTable('reserved-personnel-body', reserved, true);
                renderPersonnelTable('retired-personnel-body',  retired,  true);

                const activeTitle = document.getElementById('active-title');
                if (activeTitle) activeTitle.textContent = `⚡ Active Personnel (${active.length})`;

                const reservedTitle = document.getElementById('reserved-title');
                if (reservedTitle) reservedTitle.textContent = `🛡️ Reserved Personnel (${reserved.length})`;

                const retiredTitle = document.getElementById('retired-title');
                if (retiredTitle) retiredTitle.textContent = `🎖️ Retired Personnel (${retired.length})`;

                // Stats overview counts active + reserved only
                animateRealValue('stat-enlisted', active.length + reserved.length);
                animateRealValue('hero-stat-enlisted', active.length + reserved.length);
            }
        } catch (e) {
            console.error('Error loading members:', e);
        }
    }

    function buildMemberCard(m) {
        const card = document.createElement('div');
        card.className = 'member-card reveal';
        if (m.discord_id) card.dataset.discordId = m.discord_id;
        card.innerHTML =
            '<img class="member-photo" src="' + (m.photo_url || 'https://cdn.discordapp.com/embed/avatars/0.png') + '" alt="' + m.display_name + '" onerror="this.src=\'https://cdn.discordapp.com/embed/avatars/0.png\'">' +
            '<div class="member-name">' + m.display_name + '</div>' +
            '<div class="member-role">' + m.role_title   + '</div>';
        return card;
    }


    /* ─── DRIVER STATS CARD ─────────────────────────────── */

    async function showDriverCard(driverData) {
        var overlay = document.getElementById('driver-card-overlay');
        document.getElementById('dc-name').textContent   = driverData.display_name || 'Unknown';
        document.getElementById('dc-unit').textContent   = driverData.unit_number ? 'Unit #' + driverData.unit_number : '';
        var av = document.getElementById('dc-avatar');
        av.src = driverData.photo_url || 'https://cdn.discordapp.com/embed/avatars/0.png';
        av.onerror = function () { av.src = 'https://cdn.discordapp.com/embed/avatars/0.png'; };

        var statusMap = { AP: ['Active','ap'], RP: ['Reserved','rp'], RTD: ['Retired','rtd'] };
        var sc = statusMap[driverData.status] || ['Unknown','rp'];
        var badge = document.getElementById('dc-status');
        badge.textContent  = sc[0];
        badge.className    = 'driver-card-badge ' + sc[1];

        var dcStats = document.getElementById('dc-stats');
        dcStats.innerHTML  = '<div class="dc-loading">⏳ Fetching stats…</div>';
        overlay.classList.add('active');

        try {
            if (!driverData.discord_id) throw new Error('no discord_id');
            var pRes = await supabase.from('players').select('id').eq('discord_id', driverData.discord_id).maybeSingle();
            if (!pRes.data) { dcStats.innerHTML = '<div class="dc-no-stats">📫 No player record found.</div>'; return; }

            var sRes = await supabase.from('player_stats').select('*').eq('player_id', pRes.data.id).maybeSingle();
            if (!sRes.data) { dcStats.innerHTML = '<div class="dc-no-stats">📫 No stats recorded yet.</div>'; return; }

            var s = sRes.data;
            var fDist = function (v) { v = v || 0; return v >= 1000 ? (v/1000).toFixed(1)+'K km' : Math.round(v).toLocaleString()+' km'; };
            var fTime = function (v) { var h = Math.floor((v||0)/60); return h >= 1000 ? (h/1000).toFixed(1)+'K h' : h.toLocaleString()+' h'; };
            var fNum  = function (v) { v = v || 0; return v >= 1000 ? (v/1000).toFixed(1)+'K' : v.toLocaleString(); };
            var fMon  = function (v) { v = v || 0; return '$'+(v>=1e6?(v/1e6).toFixed(1)+'M':v>=1000?(v/1000).toFixed(1)+'K':v.toLocaleString()); };

            var items = [
                { icon:'📊', label:'Level',          val: (s.level||0) },
                { icon:'📍', label:'Total Distance', val: fDist(s.total_distance_km) },
                { icon:'⏱️', label:'Driving Time',   val: fTime(s.total_time_minutes) },
                { icon:'⚡',  label:'Best Avg Speed', val: (s.best_avg_speed_kmph||0).toFixed(1)+' km/h' },
                { icon:'✨',  label:'XP',             val: fNum(s.xp) },
                { icon:'⭐',  label:'Total Stars',    val: fNum(s.total_stars) },
                { icon:'✅',  label:'Clean Runs',     val: fNum(s.clean_deliveries) },
                { icon:'💰', label:'Net Worth',      val: fMon(s.net_worth) },
                { icon:'🚚', label:'Total Runs',     val: fNum(s.runs) },
                { icon:'⚠️', label:'Penalties',      val: 'Dm: '+(s.total_damage_penalty||0)+' | Tm: '+(s.total_time_penalty||0) },
            ];
            dcStats.innerHTML = items.map(function (it) {
                return '<div class="dc-stat"><div class="dc-stat-icon">' + it.icon + '</div>' +
                    '<div class="dc-stat-label">' + it.label + '</div>' +
                    '<div class="dc-stat-value">' + it.val + '</div></div>';
            }).join('');
        } catch (err) {
            console.error('[DriverCard]', err);
            dcStats.innerHTML = '<div class="dc-no-stats">❌ Failed to load stats.</div>';
        }
    }

    function hideDriverCard() {
        document.getElementById('driver-card-overlay').classList.remove('active');
    }
    window.hideDriverCard = hideDriverCard;

    function handleOverlayClick(e) {
        if (e.target === document.getElementById('driver-card-overlay')) hideDriverCard();
    }
    window.handleOverlayClick = handleOverlayClick;


    /* ─── 9. UTILS ──────────────────────────────────────────── */

    /* Animated number counter */
    function animateRealValue(elementId, target, suffix = '', isCurrency = false) {
        const el = document.getElementById(elementId);
        if (!el) return;

        let current = 0;
        const steps = 60;
        const inc   = target / steps;

        if (target === 0) {
            el.textContent = isCurrency ? '$0' : `0${suffix}`;
            return;
        }

        const timer = setInterval(() => {
            current = Math.min(current + inc, target);
            let displayVal = '';
            if (isCurrency) {
                displayVal = '$' + Math.floor(current).toLocaleString();
            } else if (target >= 10000) {
                displayVal = (current / 1000).toFixed(1) + 'K';
            } else {
                displayVal = Math.floor(current).toLocaleString();
            }
            el.textContent = displayVal + suffix;
            if (current >= target) clearInterval(timer);
        }, 30);
    }

    /* Scroll reveal via IntersectionObserver */
    const revealEls = document.querySelectorAll('.reveal');
    const observer  = new IntersectionObserver((entries) => {
        entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
    }, { threshold: 0.12 });
    revealEls.forEach(el => observer.observe(el));

    // Immediately reveal anything already in the viewport
    revealEls.forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) el.classList.add('visible');
    });

    /* Nav shrinks slightly on scroll */
    window.addEventListener('scroll', () => {
        const nav = document.querySelector('nav');
        nav.style.height = window.scrollY > 60 ? '58px' : '72px';
    });

}); // end DOMContentLoaded
