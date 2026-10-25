import { useEffect, useMemo, useRef, useState } from "react";
import { emptyForm, money, request } from "./api.js";
import CarArt from "./components/CarArt.jsx";
import Modal from "./components/Modal.jsx";
import VehicleCard from "./components/VehicleCard.jsx";
import {
  ArrowDownRight,
  ArrowRight,
  Check,
  ChevronDown,
  Gauge,
  LogOut,
  Menu,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

function App() {
  const [session, setSession] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("atelier-session"));
    } catch {
      return null;
    }
  });
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [authForm, setAuthForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All vehicles");
  const [maxPrice, setMaxPrice] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [sort, setSort] = useState("newest");
  const [menuOpen, setMenuOpen] = useState(false);
  const requestVersion = useRef(0);

  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());
  if (category !== "All vehicles") params.set("category", category);
  if (minPrice !== "") params.set("min_price", minPrice);
  if (maxPrice !== "") params.set("max_price", maxPrice);
  const filterQuery = params.toString();

  const notify = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3500);
  };
  const logout = () => {
    localStorage.removeItem("atelier-session");
    setSession(null);
    setVehicles([]);
    setSearchResults(null);
    setModal(null);
  };
  const refresh = async () => {
    if (!session?.token) return;
    setLoading(true);
    try {
      setVehicles(await request("/vehicles", { token: session.token }));
      if (filterQuery)
        setSearchResults(
          await request(`/vehicles/search?${filterQuery}`, {
            token: session.token,
          }),
        );
    } catch (err) {
      if (err.status === 401) logout();
      else notify(err.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    refresh();
  }, [session?.token]);

  useEffect(() => {
    if (!session?.token || !filterQuery) {
      setSearchResults(null);
      return;
    }
    const version = ++requestVersion.current;
    const timer = window.setTimeout(async () => {
      try {
        const matches = await request(`/vehicles/search?${filterQuery}`, {
          token: session.token,
        });
        if (version === requestVersion.current) setSearchResults(matches);
      } catch (err) {
        if (version === requestVersion.current) notify(err.message);
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      ++requestVersion.current;
    };
  }, [session?.token, filterQuery]);

  const filtered = useMemo(() => {
    return [...(filterQuery ? (searchResults ?? []) : vehicles)].sort((a, b) =>
      sort === "price-low"
        ? a.price - b.price
        : sort === "price-high"
          ? b.price - a.price
          : b.id - a.id,
    );
  }, [vehicles, searchResults, filterQuery, sort]);
  const categories = [
    "All vehicles",
    ...new Set(vehicles.map((car) => car.category)),
  ];
  const isAdmin = session?.user?.role === "admin";
  const inStock = vehicles.filter((car) => car.quantity > 0).length;

  async function authenticate(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const data = await request(`/auth/${authMode}`, {
        method: "POST",
        body: JSON.stringify(authForm),
      });
      localStorage.setItem("atelier-session", JSON.stringify(data));
      setSession(data);
      setModal(null);
      setAuthForm({ email: "", password: "" });
      notify(
        `Welcome ${authMode === "register" ? "to Atelier Motors" : "back"}!`,
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveVehicle(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const editing = typeof modal === "object" && modal?.type === "edit";
    try {
      await request(editing ? `/vehicles/${modal.vehicle.id}` : "/vehicles", {
        token: session.token,
        method: editing ? "PUT" : "POST",
        body: JSON.stringify({
          ...form,
          price: Number(form.price),
          quantity: Number(form.quantity),
        }),
      });
      setModal(null);
      setForm(emptyForm);
      await refresh();
      notify(editing ? "Vehicle updated." : "Vehicle added to the collection.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function action(vehicle, type, amount = 1) {
    setBusy(true);
    setError("");
    try {
      await request(`/vehicles/${vehicle.id}/${type}`, {
        token: session.token,
        method: "POST",
        ...(type === "restock" ? { body: JSON.stringify({ amount }) } : {}),
      });
      await refresh();
      setModal(null);
      notify(
        type === "purchase"
          ? `Purchase confirmed: ${vehicle.make} ${vehicle.model}.`
          : "Stock updated.",
      );
    } catch (err) {
      setError(err.message);
      if (err.status === 409) await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove(vehicle) {
    setBusy(true);
    setError("");
    try {
      await request(`/vehicles/${vehicle.id}`, {
        token: session.token,
        method: "DELETE",
      });
      await refresh();
      setModal(null);
      notify("Vehicle removed.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const openEdit = (vehicle) => {
    setForm({
      make: vehicle.make,
      model: vehicle.model,
      category: vehicle.category,
      price: vehicle.price,
      quantity: vehicle.quantity,
    });
    setError("");
    setModal({ type: "edit", vehicle });
  };
  const openAdd = () => {
    setForm(emptyForm);
    setError("");
    setModal("add");
  };
  const openAuth = (mode) => {
    setAuthMode(mode);
    setError("");
    setModal("auth");
  };

  return (
    <div className="site-shell">
      <div className="announcement">
        <span className="announcement-dot" /> THE COLLECTION IS OPEN{" "}
        <span className="announcement-divider">/</span> FIND YOUR NEXT DRIVE{" "}
        <ArrowRight size={13} />
      </div>
      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href="#top" aria-label="Atelier Motors home">
            <span className="brand-mark">
              A<span>✳</span>
            </span>
            <span className="brand-word">
              ATELIER<span>MOTORS</span>
            </span>
          </a>
          <nav
            className={menuOpen ? "navigation open" : "navigation"}
            aria-label="Main navigation"
          >
            <a href="#collection" onClick={() => setMenuOpen(false)}>
              The collection
            </a>
            <a href="#about" onClick={() => setMenuOpen(false)}>
              Our approach
            </a>
            {isAdmin && <button onClick={openAdd}>Manage inventory</button>}
          </nav>
          <div className="header-actions">
            {session ? (
              <>
                <span className="role-pill">
                  <span className="role-dot" />
                  {isAdmin ? "ADMIN" : "MEMBER"}
                </span>
                <button
                  className="account-button"
                  onClick={logout}
                  title="Log out"
                >
                  <LogOut size={16} /> <span>Log out</span>
                </button>
              </>
            ) : (
              <>
                <button
                  className="quiet-link"
                  onClick={() => openAuth("login")}
                >
                  Log in
                </button>
                <button
                  className="header-cta"
                  onClick={() => openAuth("register")}
                >
                  Get started <ArrowRight size={15} />
                </button>
              </>
            )}
            <button
              className="mobile-menu"
              aria-label="Toggle menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <Menu size={22} />
            </button>
          </div>
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-noise" />
          <div className="hero-inner grid grid-cols-1 md:grid-cols-[55%_45%] lg:grid-cols-[52%_48%]">
            <div className="hero-copy">
              <div className="hero-kicker">
                <span className="tiny-line" /> THE ART OF GOING PLACES{" "}
                <span className="hero-index">EST. 2026</span>
              </div>
              <h1>
                Drive something
                <br />
                <em>extraordinary.</em>
              </h1>
              <p>
                Thoughtfully selected cars. A refreshingly simple way to find
                the one that feels like yours.
              </p>
              <div className="hero-actions">
                <a className="primary-button" href="#collection">
                  Explore the collection <ArrowRight size={17} />
                </a>
                <a className="text-button" href="#about">
                  Why Atelier <ArrowDownRight size={17} />
                </a>
              </div>
            </div>
            <div className="hero-visual" aria-hidden="true">
              <div className="hero-ring ring-one" />
              <div className="hero-ring ring-two" />
              <div className="hero-car">
                <CarArt category="Coupe" id={1} />
              </div>
              <div className="hero-stamp">
                THE ROAD
                <br />
                IS YOURS <span>↗</span>
              </div>
              <div className="hero-vertical">
                CURATED FOR THE DRIVE AHEAD • 2026
              </div>
            </div>
          </div>
          <div className="hero-footer">
            <span>01 — THE COLLECTION</span>
            <span>SCROLL TO EXPLORE ↓</span>
          </div>
        </section>

        <section className="trust-strip" id="about">
          <div>
            <ShieldCheck size={21} />
            <span>Curated selection</span>
          </div>
          <div>
            <Sparkles size={21} />
            <span>Simple experience</span>
          </div>
          <div>
            <Gauge size={21} />
            <span>Ready for the road</span>
          </div>
          <div className="trust-caption">GOOD CARS. BETTER JOURNEYS.</div>
        </section>

        <section className="collection" id="collection">
          <div className="section-heading">
            <div>
              <div className="eyebrow dark">
                <span className="tiny-line" /> FIND YOUR FIT / 001
              </div>
              <h2>
                The collection<span className="heading-period">.</span>
              </h2>
              <p>Something for every road ahead. Take a look around.</p>
            </div>
            <div className="collection-counter">
              <strong>{String(inStock).padStart(2, "0")}</strong>
              <span>
                MODELS
                <br />
                AVAILABLE
              </span>
            </div>
          </div>
          {!session ? (
            <div className="guest-panel">
              <div className="guest-icon">
                <Search size={30} />
              </div>
              <div>
                <span className="eyebrow">YOUR NEXT DRIVE STARTS HERE</span>
                <h3>See what’s in the garage.</h3>
                <p>
                  Create a free account or log in to browse, filter, and
                  purchase our collection.
                </p>
              </div>
              <button
                className="primary-button"
                onClick={() => openAuth("register")}
              >
                Browse vehicles <ArrowRight size={17} />
              </button>
            </div>
          ) : (
            <>
              <div className="filters flex flex-wrap items-stretch gap-3">
                <label className="search-field">
                  <Search size={18} />
                  <input
                    placeholder="Search make, model, or category..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    aria-label="Search vehicles"
                  />
                  {query && (
                    <button
                      aria-label="Clear search"
                      onClick={() => setQuery("")}
                    >
                      <X size={15} />
                    </button>
                  )}
                </label>
                <div className="filter-select">
                  <SlidersHorizontal size={16} />
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    aria-label="Category"
                  >
                    {categories.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                  <ChevronDown size={15} />
                </div>
                <div className="filter-select">
                  <span className="dollar">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Min price"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    aria-label="Minimum price"
                  />
                </div>
                <div className="filter-select">
                  <span className="dollar">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Max price"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    aria-label="Maximum price"
                  />
                </div>
                <div className="filter-select sort-select">
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                    aria-label="Sort vehicles"
                  >
                    <option value="newest">Newest first</option>
                    <option value="price-low">Price: low to high</option>
                    <option value="price-high">Price: high to low</option>
                  </select>
                  <ChevronDown size={15} />
                </div>
              </div>
              <div className="results-line">
                <span>
                  SHOWING <b>{filtered.length}</b> OF <b>{vehicles.length}</b>{" "}
                  VEHICLES
                </span>
                {isAdmin && (
                  <button className="add-button" onClick={openAdd}>
                    <Plus size={17} /> Add vehicle
                  </button>
                )}
              </div>
              {loading ? (
                <div className="empty-state">Loading the collection…</div>
              ) : filtered.length ? (
                <div className="vehicle-grid grid grid-cols-1 gap-[22px] md:grid-cols-2 xl:grid-cols-3">
                  {filtered.map((car) => (
                    <VehicleCard
                      key={car.id}
                      car={car}
                      busy={busy}
                      isAdmin={isAdmin}
                      onEdit={openEdit}
                      openAction={(type, vehicle) => {
                        setError("");
                        setModal({ type, vehicle });
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <Search size={28} />
                  <h3>No vehicles found</h3>
                  <p>
                    {vehicles.length
                      ? "Try adjusting your search or filters."
                      : "The collection is waiting for its first vehicle."}
                  </p>
                  {isAdmin && !vehicles.length && (
                    <button className="primary-button" onClick={openAdd}>
                      Add the first vehicle <ArrowRight size={16} />
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </section>

        <section className="closing">
          <div className="closing-inner">
            <div>
              <span className="eyebrow">BEYOND THE DESTINATION</span>
              <h2>
                Your next chapter
                <br />
                <em>starts here.</em>
              </h2>
            </div>
            <a href="#collection" className="closing-link">
              Explore vehicles <ArrowRight size={20} />
            </a>
          </div>
        </section>
      </main>
      <footer>
        <div className="footer-inner">
          <div className="footer-brand">
            ATELIER <span>MOTORS</span>
          </div>
          <span>CURATED FOR THE DRIVE AHEAD.</span>
          <span>© 2026 ATELIER MOTORS</span>
        </div>
      </footer>

      {modal === "auth" && (
        <Modal
          title={authMode === "login" ? "Welcome back." : "Join the journey."}
          onClose={() => setModal(null)}
        >
          <p className="modal-intro">
            {authMode === "login"
              ? "Log in to explore the collection."
              : "Your next great drive is a few clicks away."}
          </p>
          <form onSubmit={authenticate} className="form-stack">
            <label>
              Email address
              <input
                type="email"
                required
                autoComplete="email"
                value={authForm.email}
                onChange={(e) =>
                  setAuthForm({ ...authForm, email: e.target.value })
                }
                placeholder="you@example.com"
              />
            </label>
            <label>
              Password
              <input
                type="password"
                minLength={authMode === "register" ? 8 : undefined}
                required
                autoComplete={
                  authMode === "login" ? "current-password" : "new-password"
                }
                value={authForm.password}
                onChange={(e) =>
                  setAuthForm({ ...authForm, password: e.target.value })
                }
                placeholder="At least 8 characters"
              />
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="primary-button full" disabled={busy}>
              {busy
                ? "One moment…"
                : authMode === "login"
                  ? "Log in"
                  : "Create account"}{" "}
              <ArrowRight size={17} />
            </button>
          </form>
          <div className="form-switch">
            {authMode === "login"
              ? "New around here?"
              : "Already have an account?"}{" "}
            <button
              onClick={() => {
                setError("");
                setAuthMode(authMode === "login" ? "register" : "login");
              }}
            >
              {authMode === "login" ? "Create an account" : "Log in"}
            </button>
          </div>
        </Modal>
      )}
      {(modal === "add" || modal?.type === "edit") && (
        <Modal
          title={modal === "add" ? "Add a vehicle." : "Edit vehicle."}
          onClose={() => setModal(null)}
        >
          <p className="modal-intro">Keep the collection looking its best.</p>
          <form className="form-stack" onSubmit={saveVehicle}>
            <div className="form-row">
              <label>
                Make
                <input
                  required
                  maxLength="80"
                  value={form.make}
                  onChange={(e) => setForm({ ...form, make: e.target.value })}
                  placeholder="e.g. Honda"
                />
              </label>
              <label>
                Model
                <input
                  required
                  maxLength="80"
                  value={form.model}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                  placeholder="e.g. Civic"
                />
              </label>
            </div>
            <label>
              Category
              <input
                required
                list="vehicle-categories"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              />
              <datalist id="vehicle-categories">
                {["Sedan", "SUV", "Coupe", "Electric", "Truck", "Other"].map(
                  (c) => (
                    <option key={c}>{c}</option>
                  ),
                )}
              </datalist>
            </label>
            <div className="form-row">
              <label>
                Price ($)
                <input
                  type="number"
                  required
                  min="0"
                  max="9999999999"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  placeholder="24500.00"
                />
              </label>
              <label>
                Quantity
                <input
                  type="number"
                  required
                  min="0"
                  max="1000000"
                  step="1"
                  value={form.quantity}
                  onChange={(e) =>
                    setForm({ ...form, quantity: e.target.value })
                  }
                />
              </label>
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="primary-button full" disabled={busy}>
              {busy
                ? "Saving…"
                : modal === "add"
                  ? "Add to collection"
                  : "Save changes"}{" "}
              <ArrowRight size={17} />
            </button>
          </form>
        </Modal>
      )}
      {modal?.type === "purchase" && (
        <Modal title="Make it yours." onClose={() => setModal(null)}>
          <p className="modal-intro">
            Confirm your purchase of the{" "}
            <b>
              {modal.vehicle.make} {modal.vehicle.model}
            </b>{" "}
            for <b>{money(modal.vehicle.price)}</b>. This will reserve one unit
            from inventory.
          </p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="primary-button full"
            disabled={busy}
            onClick={() => action(modal.vehicle, "purchase")}
          >
            {busy ? "Processing…" : "Confirm purchase"} <ArrowRight size={17} />
          </button>
        </Modal>
      )}
      {modal?.type === "restock" && (
        <Modal title="Restock vehicle." onClose={() => setModal(null)}>
          <p className="modal-intro">
            Add units to {modal.vehicle.make} {modal.vehicle.model}. Currently
            in stock: {modal.vehicle.quantity}.
          </p>
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              action(
                modal.vehicle,
                "restock",
                Number(e.currentTarget.elements.amount.value),
              );
            }}
          >
            <label>
              Units to add
              <input
                name="amount"
                type="number"
                min="1"
                max="1000000"
                defaultValue="1"
                required
              />
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="primary-button full" disabled={busy}>
              Add to stock <Plus size={17} />
            </button>
          </form>
        </Modal>
      )}
      {modal?.type === "delete" && (
        <Modal title="Remove vehicle?" onClose={() => setModal(null)}>
          <p className="modal-intro">
            This will permanently remove {modal.vehicle.make}{" "}
            {modal.vehicle.model} from the collection.
          </p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="danger-button"
            disabled={busy}
            onClick={() => remove(modal.vehicle)}
          >
            <Trash2 size={17} /> {busy ? "Removing…" : "Yes, remove vehicle"}
          </button>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast}
        </div>
      )}
    </div>
  );
}

export default App;
