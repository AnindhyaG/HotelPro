import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Routes, Route, Link, NavLink, Navigate, useNavigate } from 'react-router-dom';
import { api, money, day } from './api.js';

const Auth = createContext();
const useAuth = () => useContext(Auth);
const iso = (offset = 0) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);

export default function App() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!localStorage.getItem('hp_token')) return setReady(true);
    api('/auth/me').then((d) => setUser(d.user)).catch(() => localStorage.removeItem('hp_token')).finally(() => setReady(true));
  }, []);
  const login = ({ token, user }) => { localStorage.setItem('hp_token', token); setUser(user); };
  const logout = () => { localStorage.removeItem('hp_token'); setUser(null); };
  if (!ready) return <p className="center">Loading…</p>;
  const staff = user && ['admin', 'staff'].includes(user.role);
  return (
    <Auth.Provider value={{ user, login, logout }}>
      <header className="bar">
        <Link to="/" className="logo">HotelPro</Link>
        <nav>
          <NavLink to="/">Rooms</NavLink>
          {user && <NavLink to="/bookings">My bookings</NavLink>}
          {staff && <NavLink to="/admin">Manage hotel</NavLink>}
          {user ? <button className="link" onClick={logout}>Log out ({user.name.split(' ')[0]})</button> : <NavLink to="/login">Log in</NavLink>}
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Rooms />} />
          <Route path="/login" element={<AuthForm />} />
          <Route path="/bookings" element={user ? <MyBookings /> : <Navigate to="/login" />} />
          <Route path="/admin" element={staff ? <Admin /> : <Navigate to="/login" />} />
        </Routes>
      </main>
    </Auth.Provider>
  );
}

function Rooms() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [q, setQ] = useState({ checkIn: iso(1), checkOut: iso(2), guests: 1, type: '' });
  const [rooms, setRooms] = useState([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const search = useCallback(() => {
    const p = new URLSearchParams(Object.entries(q).filter(([, v]) => v));
    api('/rooms?' + p).then(setRooms).catch((e) => setMsg(e.message));
  }, [q]);
  useEffect(search, []);
  const nights = Math.max(0, Math.round((new Date(q.checkOut) - new Date(q.checkIn)) / 864e5));
  const book = async (room) => {
    if (!user) return nav('/login');
    setBusy(true); setMsg('');
    try { await api('/bookings', { method: 'POST', body: { roomId: room._id, ...q } }); nav('/bookings'); }
    catch (e) { setMsg(e.message); search(); } finally { setBusy(false); }
  };
  return (
    <>
      <section className="hero">
        <h1>Find a room for your stay</h1>
        <form className="search" onSubmit={(e) => { e.preventDefault(); setMsg(''); search(); }}>
          <label>Check-in<input type="date" min={iso()} value={q.checkIn} onChange={(e) => setQ({ ...q, checkIn: e.target.value })} /></label>
          <label>Check-out<input type="date" min={q.checkIn} value={q.checkOut} onChange={(e) => setQ({ ...q, checkOut: e.target.value })} /></label>
          <label>Guests<input type="number" min="1" max="6" value={q.guests} onChange={(e) => setQ({ ...q, guests: e.target.value })} /></label>
          <label>Room type<select value={q.type} onChange={(e) => setQ({ ...q, type: e.target.value })}><option value="">Any</option>{['Single', 'Double', 'Deluxe', 'Suite'].map((t) => <option key={t}>{t}</option>)}</select></label>
          <button className="primary">Search rooms</button>
        </form>
      </section>
      {msg && <p className="error">{msg}</p>}
      <p className="muted">{rooms.length} rooms available · {nights} night{nights === 1 ? '' : 's'}</p>
      {!rooms.length && <p className="empty">No rooms are free for these dates. Try different dates or fewer guests.</p>}
      <div className="grid">
        {rooms.map((r) => (
          <article className="card" key={r._id}>
            <div className="room-no">{r.number}</div>
            <h3>{r.type} room</h3>
            <p className="muted">Sleeps {r.capacity} · {r.amenities.join(', ')}</p>
            <p className="price">{money(r.pricePerNight)} <span>per night</span></p>
            {nights > 0 && <p className="muted">{money(r.pricePerNight * nights)} for {nights} night{nights > 1 ? 's' : ''}</p>}
            <button className="primary" disabled={busy || nights < 1} onClick={() => book(r)}>Book this room</button>
          </article>
        ))}
      </div>
    </>
  );
}

function AuthForm() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '' });
  const [err, setErr] = useState('');
  const submit = async (e) => {
    e.preventDefault(); setErr('');
    try { login(await api(`/auth/${mode}`, { method: 'POST', body: f })); nav('/'); } catch (x) { setErr(x.message); }
  };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <form className="panel narrow" onSubmit={submit}>
      <h2>{mode === 'login' ? 'Log in' : 'Create your account'}</h2>
      {mode === 'register' && <><label>Full name<input required value={f.name} onChange={set('name')} /></label><label>Phone<input value={f.phone} onChange={set('phone')} /></label></>}
      <label>Email<input type="email" required value={f.email} onChange={set('email')} /></label>
      <label>Password<input type="password" required minLength="6" value={f.password} onChange={set('password')} /></label>
      {err && <p className="error">{err}</p>}
      <button className="primary">{mode === 'login' ? 'Log in' : 'Create account'}</button>
      <button type="button" className="link" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
        {mode === 'login' ? 'New here? Create an account' : 'Have an account? Log in'}
      </button>
    </form>
  );
}

const Status = ({ b }) => <span className={'tag ' + b.status}>{b.status}</span>;

function MyBookings() {
  const [list, setList] = useState(null);
  const [err, setErr] = useState('');
  const load = () => api('/bookings/mine').then(setList).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);
  const act = (fn) => fn().then(load).catch((e) => setErr(e.message));
  if (!list) return <p>{err || 'Loading…'}</p>;
  return (
    <>
      <h2>My bookings</h2>
      {err && <p className="error">{err}</p>}
      {!list.length && <p className="empty">You have no bookings yet. <Link to="/">Find a room</Link>.</p>}
      {list.map((b) => (
        <div className="row" key={b._id}>
          <div><strong>{b.room?.type} room {b.room?.number}</strong><br /><span className="muted">{day(b.checkIn)} to {day(b.checkOut)} · {b.nights} nights · {b.guests} guests</span></div>
          <div>{money(b.total)}<br /><Status b={b} /> <span className={'tag pay-' + b.payment.status}>{b.payment.status}</span></div>
          <div className="actions">
            {b.status !== 'cancelled' && b.payment.status === 'pending' && <button className="primary" onClick={() => act(() => api(`/bookings/${b._id}/pay`, { method: 'POST' }))}>Pay now</button>}
            {b.payment.transactionId && <span className="muted">{b.payment.transactionId}</span>}
            {b.status === 'confirmed' && <button onClick={() => confirm('Cancel this booking?') && act(() => api(`/bookings/${b._id}/status`, { method: 'PATCH', body: { status: 'cancelled' } }))}>Cancel</button>}
          </div>
        </div>
      ))}
    </>
  );
}

function Admin() {
  const { user } = useAuth();
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState({});
  const [bookings, setBookings] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [guests, setGuests] = useState([]);
  const [err, setErr] = useState('');
  const [nr, setNr] = useState({ number: '', type: 'Double', pricePerNight: 2500, capacity: 2, amenities: 'Wi-Fi, AC' });
  const load = () => Promise.all([
    api('/admin/stats').then(setStats), api('/bookings').then(setBookings), api('/rooms').then(setRooms), api('/admin/guests').then(setGuests),
  ]).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);
  const act = (fn) => fn().then(load).catch((e) => setErr(e.message));
  const setStatus = (id, status) => act(() => api(`/bookings/${id}/status`, { method: 'PATCH', body: { status } }));
  const addRoom = (e) => { e.preventDefault(); act(() => api('/rooms', { method: 'POST', body: { ...nr, amenities: nr.amenities.split(',').map((s) => s.trim()).filter(Boolean) } })).then(() => setNr({ ...nr, number: '' })); };
  return (
    <>
      <h2>Manage hotel</h2>
      {err && <p className="error">{err}</p>}
      <div className="tabs">{['overview', 'bookings', 'rooms', 'guests'].map((t) => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>)}</div>
      {tab === 'overview' && <div className="stats">
        {[['Occupancy today', stats.occupancy + '%'], ['Rooms occupied', `${stats.occupied} of ${stats.rooms}`], ['Arrivals today', stats.arrivals], ['Departures today', stats.departures], ['Total bookings', stats.bookings], ['Guests', stats.guests], ['Revenue collected', money(stats.revenue)]]
          .map(([k, v]) => <div className="stat" key={k}><b>{v}</b><span>{k}</span></div>)}
      </div>}
      {tab === 'bookings' && (bookings.length ? bookings.map((b) => (
        <div className="row" key={b._id}>
          <div><strong>{b.user?.name}</strong> · room {b.room?.number}<br /><span className="muted">{day(b.checkIn)} to {day(b.checkOut)} · {b.user?.email}</span></div>
          <div>{money(b.total)}<br /><Status b={b} /> <span className={'tag pay-' + b.payment.status}>{b.payment.status}</span></div>
          <div className="actions">
            {b.status === 'confirmed' && <button className="primary" onClick={() => setStatus(b._id, 'checked-in')}>Check in</button>}
            {b.status === 'checked-in' && <button className="primary" onClick={() => setStatus(b._id, 'checked-out')}>Check out</button>}
            {b.status === 'confirmed' && <button onClick={() => setStatus(b._id, 'cancelled')}>Cancel</button>}
          </div>
        </div>)) : <p className="empty">No bookings yet.</p>)}
      {tab === 'rooms' && <>
        {user.role === 'admin' && <form className="panel inline" onSubmit={addRoom}>
          <label>Room number<input required value={nr.number} onChange={(e) => setNr({ ...nr, number: e.target.value })} /></label>
          <label>Type<select value={nr.type} onChange={(e) => setNr({ ...nr, type: e.target.value })}>{['Single', 'Double', 'Deluxe', 'Suite'].map((t) => <option key={t}>{t}</option>)}</select></label>
          <label>Price per night<input type="number" min="0" value={nr.pricePerNight} onChange={(e) => setNr({ ...nr, pricePerNight: +e.target.value })} /></label>
          <label>Sleeps<input type="number" min="1" value={nr.capacity} onChange={(e) => setNr({ ...nr, capacity: +e.target.value })} /></label>
          <label>Amenities<input value={nr.amenities} onChange={(e) => setNr({ ...nr, amenities: e.target.value })} /></label>
          <button className="primary">Add room</button>
        </form>}
        {rooms.map((r) => <div className="row" key={r._id}><div><strong>{r.number}</strong> · {r.type}<br /><span className="muted">Sleeps {r.capacity} · {r.amenities.join(', ')}</span></div><div>{money(r.pricePerNight)}</div>
          <div className="actions">{user.role === 'admin' && <><button onClick={() => { const p = prompt('New price per night', r.pricePerNight); p && act(() => api('/rooms/' + r._id, { method: 'PUT', body: { pricePerNight: +p } })); }}>Change price</button>
            <button onClick={() => confirm(`Remove room ${r.number}?`) && act(() => api('/rooms/' + r._id, { method: 'DELETE' }))}>Remove</button></>}</div></div>)}
      </>}
      {tab === 'guests' && (guests.length ? guests.map((g) => <div className="row" key={g._id}><div><strong>{g.name}</strong><br /><span className="muted">{g.email} {g.phone && '· ' + g.phone}</span></div><div className="muted">Joined {day(g.createdAt)}</div></div>) : <p className="empty">No guests have registered yet.</p>)}
    </>
  );
}
