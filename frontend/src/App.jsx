import { useEffect, useMemo, useState } from 'react'
import { ArrowDownRight, ArrowRight, Check, ChevronDown, CircleHelp, Gauge, Heart, LogOut, Menu, Minus, Plus, Search, ShieldCheck, SlidersHorizontal, Sparkles, Trash2, X } from 'lucide-react'

const API = '/api'
const money = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value)
const emptyForm = { make: '', model: '', category: 'Sedan', price: '', quantity: 1 }

async function request(path, { token, ...options } = {}) {
  const response = await fetch(`${API}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers } })
  if (response.status === 204) return null
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const detail = data.detail
    throw new Error(typeof detail === 'string' ? detail : Array.isArray(detail) ? detail.map(item => item.msg).join(', ') : 'Something went wrong. Please try again.')
  }
  return data
}

function CarArt({ category, id }) {
  const palette = { SUV: ['#dce2da', '#6e7e72'], Sedan: ['#d9dedc', '#60736c'], Coupe: ['#e0d8cf', '#89735d'], Electric: ['#dce5e3', '#637e80'], Truck: ['#e1ded8', '#77756b'] }
  const [sky, car] = palette[category] || ['#e3e1dc', '#797b74']
  return <div className="car-art" style={{ '--sky': sky }}>
    <span className="art-number">AM / {String(id).padStart(3, '0')}</span>
    <svg viewBox="0 0 570 245" role="img" aria-label={`${category} illustration`} className="car-svg">
      <ellipse cx="286" cy="211" rx="230" ry="13" fill="#1b2725" opacity=".13" />
      <path d="M56 160 C68 149 97 143 132 139 L169 92 C180 79 202 74 232 73 L353 73 C378 73 397 83 411 99 L449 139 C481 141 510 149 520 163 L529 188 Q527 199 514 200 L61 200 Q49 196 49 184 Z" fill={car} stroke="#34453e" strokeWidth="3" />
      <path d="M175 139 L203 96 Q211 86 234 86 L276 86 L276 139 Z M289 86 L352 86 Q373 86 385 100 L417 139 L289 139 Z" fill="#c7d5d0" stroke="#3c524c" strokeWidth="3" />
      <path d="M278 85 L288 85 L288 141 L278 141 Z" fill="#465950" />
      <path d="M64 164 L102 163 L97 176 L53 176 M484 161 L520 166 L526 180 L482 179" fill="#eee1c3" stroke="#465950" strokeWidth="2" />
      <path d="M155 156 H414 M350 148 H374" stroke="#d6e0d9" strokeWidth="2" opacity=".55" />
      <circle cx="144" cy="194" r="31" fill="#26322d" /><circle cx="144" cy="194" r="17" fill="#a6ada5" /><circle cx="144" cy="194" r="7" fill="#44534b" />
      <circle cx="431" cy="194" r="31" fill="#26322d" /><circle cx="431" cy="194" r="17" fill="#a6ada5" /><circle cx="431" cy="194" r="7" fill="#44534b" />
    </svg>
    <span className="art-category">{category.toUpperCase()} / COLLECTION</span>
  </div>
}

function Modal({ title, onClose, children }) {
  useEffect(() => { const close = event => { if (event.key === 'Escape') onClose() }; document.addEventListener('keydown', close); return () => document.removeEventListener('keydown', close) }, [onClose])
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}><section className="modal" role="dialog" aria-modal="true" aria-label={title}><div className="modal-header"><div><span className="eyebrow">ATELIER MOTORS</span><h2>{title}</h2></div><button className="icon-button" aria-label="Close" onClick={onClose}><X size={20}/></button></div>{children}</section></div>
}

function App() {
  const [session, setSession] = useState(() => { try { return JSON.parse(localStorage.getItem('atelier-session')) } catch { return null } })
  const [vehicles, setVehicles] = useState([])
  const [loading, setLoading] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [authForm, setAuthForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All vehicles')
  const [maxPrice, setMaxPrice] = useState('')
  const [sort, setSort] = useState('newest')
  const [menuOpen, setMenuOpen] = useState(false)

  const notify = message => { setToast(message); window.setTimeout(() => setToast(''), 3500) }
  const logout = () => { localStorage.removeItem('atelier-session'); setSession(null); setVehicles([]); setModal(null) }
  const refresh = async () => {
    if (!session?.token) return
    setLoading(true)
    try { setVehicles(await request('/vehicles', { token: session.token })) }
    catch (err) { if (/token|Authentication/.test(err.message)) logout(); else notify(err.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { refresh() }, [session?.token])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return vehicles.filter(car => (!needle || `${car.make} ${car.model} ${car.category}`.toLowerCase().includes(needle)) && (category === 'All vehicles' || car.category === category) && (!maxPrice || car.price <= Number(maxPrice)))
      .sort((a, b) => sort === 'price-low' ? a.price - b.price : sort === 'price-high' ? b.price - a.price : b.id - a.id)
  }, [vehicles, query, category, maxPrice, sort])
  const categories = ['All vehicles', ...new Set(vehicles.map(car => car.category))]
  const isAdmin = session?.user?.role === 'admin'
  const inStock = vehicles.filter(car => car.quantity > 0).length

  async function authenticate(event) {
    event.preventDefault(); setError(''); setBusy(true)
    try { const data = await request(`/auth/${authMode}`, { method: 'POST', body: JSON.stringify(authForm) }); localStorage.setItem('atelier-session', JSON.stringify(data)); setSession(data); setModal(null); setAuthForm({ email: '', password: '' }); notify(`Welcome ${authMode === 'register' ? 'to Atelier Motors' : 'back'}!`) }
    catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  async function saveVehicle(event) {
    event.preventDefault(); setError(''); setBusy(true)
    const editing = typeof modal === 'object' && modal?.type === 'edit'
    try {
      await request(editing ? `/vehicles/${modal.vehicle.id}` : '/vehicles', { token: session.token, method: editing ? 'PUT' : 'POST', body: JSON.stringify({ ...form, price: Number(form.price), quantity: Number(form.quantity) }) })
      setModal(null); setForm(emptyForm); await refresh(); notify(editing ? 'Vehicle updated.' : 'Vehicle added to the collection.')
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  async function action(vehicle, type, amount = 1) {
    setBusy(true); setError('')
    try {
      await request(`/vehicles/${vehicle.id}/${type}`, { token: session.token, method: 'POST', ...(type === 'restock' ? { body: JSON.stringify({ amount }) } : {}) })
      await refresh(); setModal(null); notify(type === 'purchase' ? `Purchase confirmed: ${vehicle.make} ${vehicle.model}.` : 'Stock updated.')
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  async function remove(vehicle) {
    setBusy(true); setError('')
    try { await request(`/vehicles/${vehicle.id}`, { token: session.token, method: 'DELETE' }); await refresh(); setModal(null); notify('Vehicle removed.') }
    catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  const openEdit = vehicle => { setForm({ make: vehicle.make, model: vehicle.model, category: vehicle.category, price: vehicle.price, quantity: vehicle.quantity }); setError(''); setModal({ type: 'edit', vehicle }) }
  const openAdd = () => { setForm(emptyForm); setError(''); setModal('add') }
  const openAuth = mode => { setAuthMode(mode); setError(''); setModal('auth') }

  return <div className="site-shell">
    <div className="announcement"><span className="announcement-dot"/> THE COLLECTION IS OPEN <span className="announcement-divider">/</span> FIND YOUR NEXT DRIVE <ArrowRight size={13}/></div>
    <header className="site-header"><div className="header-inner">
      <a className="brand" href="#top" aria-label="Atelier Motors home"><span className="brand-mark">A<span>✳</span></span><span className="brand-word">ATELIER<span>MOTORS</span></span></a>
      <nav className={menuOpen ? 'navigation open' : 'navigation'} aria-label="Main navigation"><a href="#collection" onClick={() => setMenuOpen(false)}>The collection</a><a href="#about" onClick={() => setMenuOpen(false)}>Our approach</a>{isAdmin && <button onClick={openAdd}>Manage inventory</button>}</nav>
      <div className="header-actions">{session ? <><span className="role-pill"><span className="role-dot"/>{isAdmin ? 'ADMIN' : 'MEMBER'}</span><button className="account-button" onClick={logout} title="Log out"><LogOut size={16}/> <span>Log out</span></button></> : <><button className="quiet-link" onClick={() => openAuth('login')}>Log in</button><button className="header-cta" onClick={() => openAuth('register')}>Get started <ArrowRight size={15}/></button></>}<button className="mobile-menu" aria-label="Toggle menu" onClick={() => setMenuOpen(!menuOpen)}><Menu size={22}/></button></div>
    </div></header>

    <main id="top">
      <section className="hero"><div className="hero-noise"/><div className="hero-inner"><div className="hero-copy"><div className="hero-kicker"><span className="tiny-line"/> THE ART OF GOING PLACES <span className="hero-index">EST. 2026</span></div><h1>Drive something<br/><em>extraordinary.</em></h1><p>Thoughtfully selected cars. A refreshingly simple way to find the one that feels like yours.</p><div className="hero-actions"><a className="primary-button" href="#collection">Explore the collection <ArrowRight size={17}/></a><a className="text-button" href="#about">Why Atelier <ArrowDownRight size={17}/></a></div></div><div className="hero-visual" aria-hidden="true"><div className="hero-ring ring-one"/><div className="hero-ring ring-two"/><div className="hero-car"><CarArt category="Coupe" id={1}/></div><div className="hero-stamp">THE ROAD<br/>IS YOURS <span>↗</span></div><div className="hero-vertical">CURATED FOR THE DRIVE AHEAD • 2026</div></div></div><div className="hero-footer"><span>01 — THE COLLECTION</span><span>SCROLL TO EXPLORE ↓</span></div></section>

      <section className="trust-strip" id="about"><div><ShieldCheck size={21}/><span>Curated selection</span></div><div><Sparkles size={21}/><span>Simple experience</span></div><div><Gauge size={21}/><span>Ready for the road</span></div><div className="trust-caption">GOOD CARS. BETTER JOURNEYS.</div></section>

      <section className="collection" id="collection"><div className="section-heading"><div><div className="eyebrow dark"><span className="tiny-line"/> FIND YOUR FIT / 001</div><h2>The collection<span className="heading-period">.</span></h2><p>Something for every road ahead. Take a look around.</p></div><div className="collection-counter"><strong>{String(inStock).padStart(2, '0')}</strong><span>MODELS<br/>AVAILABLE</span></div></div>
        {!session ? <div className="guest-panel"><div className="guest-icon"><Search size={30}/></div><div><span className="eyebrow">YOUR NEXT DRIVE STARTS HERE</span><h3>See what’s in the garage.</h3><p>Create a free account or log in to browse, filter, and purchase our collection.</p></div><button className="primary-button" onClick={() => openAuth('register')}>Browse vehicles <ArrowRight size={17}/></button></div> : <>
        <div className="filters"><label className="search-field"><Search size={18}/><input placeholder="Search make, model, or category..." value={query} onChange={e => setQuery(e.target.value)} aria-label="Search vehicles"/>{query && <button aria-label="Clear search" onClick={() => setQuery('')}><X size={15}/></button>}</label><div className="filter-select"><SlidersHorizontal size={16}/><select value={category} onChange={e => setCategory(e.target.value)} aria-label="Category">{categories.map(c => <option key={c}>{c}</option>)}</select><ChevronDown size={15}/></div><div className="filter-select"><span className="dollar">$</span><input type="number" min="0" placeholder="Max price" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} aria-label="Maximum price"/></div><div className="filter-select sort-select"><select value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort vehicles"><option value="newest">Newest first</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option></select><ChevronDown size={15}/></div></div>
        <div className="results-line"><span>SHOWING <b>{filtered.length}</b> OF <b>{vehicles.length}</b> VEHICLES</span>{isAdmin && <button className="add-button" onClick={openAdd}><Plus size={17}/> Add vehicle</button>}</div>
        {loading ? <div className="empty-state">Loading the collection…</div> : filtered.length ? <div className="vehicle-grid">{filtered.map((car, index) => <article className="vehicle-card" key={car.id}><div className="card-image"><CarArt category={car.category} id={car.id}/><span className={car.quantity ? 'stock-badge' : 'stock-badge sold'}><span/> {car.quantity ? `${car.quantity} IN STOCK` : 'SOLD OUT'}</span></div><div className="card-body"><div className="card-heading"><div><span className="car-index">{String(index + 1).padStart(2, '0')} / {car.category.toUpperCase()}</span><h3>{car.make} <span>{car.model}</span></h3></div><span className="card-arrow"><ArrowDownRight size={21}/></span></div><div className="card-bottom"><div><span className="price-label">STARTING AT</span><strong>{money(car.price)}</strong></div><button disabled={!car.quantity || busy} className="purchase-button" onClick={() => { setError(''); setModal({ type: 'purchase', vehicle: car }) }}>{car.quantity ? 'Purchase' : 'Unavailable'} <ArrowRight size={16}/></button></div>{isAdmin && <div className="admin-actions"><button onClick={() => openEdit(car)}>Edit details</button><button onClick={() => { setError(''); setModal({ type: 'restock', vehicle: car }) }}>Restock</button><button onClick={() => { setError(''); setModal({ type: 'delete', vehicle: car }) }}>Delete</button></div>}</div></article>)}</div> : <div className="empty-state"><Search size={28}/><h3>No vehicles found</h3><p>{vehicles.length ? 'Try adjusting your search or filters.' : 'The collection is waiting for its first vehicle.'}</p>{isAdmin && !vehicles.length && <button className="primary-button" onClick={openAdd}>Add the first vehicle <ArrowRight size={16}/></button>}</div>}</>}
      </section>

      <section className="closing"><div className="closing-inner"><div><span className="eyebrow">BEYOND THE DESTINATION</span><h2>Your next chapter<br/><em>starts here.</em></h2></div><a href="#collection" className="closing-link">Explore vehicles <ArrowRight size={20}/></a></div></section>
    </main><footer><div className="footer-inner"><div className="footer-brand">ATELIER <span>MOTORS</span></div><span>CURATED FOR THE DRIVE AHEAD.</span><span>© 2026 ATELIER MOTORS</span></div></footer>

    {modal === 'auth' && <Modal title={authMode === 'login' ? 'Welcome back.' : 'Join the journey.'} onClose={() => setModal(null)}><p className="modal-intro">{authMode === 'login' ? 'Log in to explore the collection.' : 'Your next great drive is a few clicks away.'}</p><form onSubmit={authenticate} className="form-stack"><label>Email address<input type="email" required autoComplete="email" value={authForm.email} onChange={e => setAuthForm({ ...authForm, email: e.target.value })} placeholder="you@example.com"/></label><label>Password<input type="password" minLength={authMode === 'register' ? 8 : undefined} required autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} value={authForm.password} onChange={e => setAuthForm({ ...authForm, password: e.target.value })} placeholder="At least 8 characters"/></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button full" disabled={busy}>{busy ? 'One moment…' : authMode === 'login' ? 'Log in' : 'Create account'} <ArrowRight size={17}/></button></form><div className="form-switch">{authMode === 'login' ? 'New around here?' : 'Already have an account?'} <button onClick={() => { setError(''); setAuthMode(authMode === 'login' ? 'register' : 'login') }}>{authMode === 'login' ? 'Create an account' : 'Log in'}</button></div></Modal>}
    {(modal === 'add' || modal?.type === 'edit') && <Modal title={modal === 'add' ? 'Add a vehicle.' : 'Edit vehicle.'} onClose={() => setModal(null)}><p className="modal-intro">Keep the collection looking its best.</p><form className="form-stack" onSubmit={saveVehicle}><div className="form-row"><label>Make<input required maxLength="80" value={form.make} onChange={e => setForm({ ...form, make: e.target.value })} placeholder="e.g. Honda"/></label><label>Model<input required maxLength="80" value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} placeholder="e.g. Civic"/></label></div><label>Category<select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{['Sedan', 'SUV', 'Coupe', 'Electric', 'Truck', 'Other'].map(c => <option key={c}>{c}</option>)}</select></label><div className="form-row"><label>Price ($)<input type="number" required min="0" max="9999999999" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="24500.00"/></label><label>Quantity<input type="number" required min="0" step="1" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })}/></label></div>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button full" disabled={busy}>{busy ? 'Saving…' : modal === 'add' ? 'Add to collection' : 'Save changes'} <ArrowRight size={17}/></button></form></Modal>}
    {modal?.type === 'purchase' && <Modal title="Make it yours." onClose={() => setModal(null)}><p className="modal-intro">Confirm your purchase of the <b>{modal.vehicle.make} {modal.vehicle.model}</b> for <b>{money(modal.vehicle.price)}</b>. This will reserve one unit from inventory.</p>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button full" disabled={busy} onClick={() => action(modal.vehicle, 'purchase')}>{busy ? 'Processing…' : 'Confirm purchase'} <ArrowRight size={17}/></button></Modal>}
    {modal?.type === 'restock' && <Modal title="Restock vehicle." onClose={() => setModal(null)}><p className="modal-intro">Add units to {modal.vehicle.make} {modal.vehicle.model}. Currently in stock: {modal.vehicle.quantity}.</p><form className="form-stack" onSubmit={e => { e.preventDefault(); action(modal.vehicle, 'restock', Number(e.currentTarget.elements.amount.value)) }}><label>Units to add<input name="amount" type="number" min="1" max="1000000" defaultValue="1" required/></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button full" disabled={busy}>Add to stock <Plus size={17}/></button></form></Modal>}
    {modal?.type === 'delete' && <Modal title="Remove vehicle?" onClose={() => setModal(null)}><p className="modal-intro">This will permanently remove {modal.vehicle.make} {modal.vehicle.model} from the collection.</p>{error && <p className="form-error" role="alert">{error}</p>}<button className="danger-button" disabled={busy} onClick={() => remove(modal.vehicle)}><Trash2 size={17}/> {busy ? 'Removing…' : 'Yes, remove vehicle'}</button></Modal>}
    {toast && <div className="toast" role="status"><Check size={16}/>{toast}</div>}
  </div>
}

export default App
