"use client";
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured, officialSupabase } from '../lib/supabase';

const AppContext = createContext();

function parseOrderObj(o) {
  if (!o) return o;
  return {
    ...o,
    items: typeof o.items === 'string' ? (() => { try { return JSON.parse(o.items); } catch (e) { return []; } })() : (o.items || []),
    onDemandRequests: typeof o.onDemandRequests === 'string'
      ? (() => { try { return JSON.parse(o.onDemandRequests); } catch (e) { return []; } })()
      : (o.onDemandRequests || [])
  };
}

export function AppProvider({ children }) {
  const [stations, setStations] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [freeProduct, setFreeProduct] = useState("");
  const [codPolicy, setCodPolicy] = useState('always_allow');
  const [codCutoffHour, setCodCutoffHour] = useState(21);
  const [availableStates, setAvailableStates] = useState([]);
  const [deliveryCharge, setDeliveryCharge] = useState(0);
  const [giftThreshold, setGiftThreshold] = useState(0);
  const [supportPhone, setSupportPhone] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [supportContacts, setSupportContacts] = useState([]);
  const [siteFaqs, setSiteFaqs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [homepageHeroDesktop, setHomepageHeroDesktop] = useState("/herobanner.png");
  const [homepageHeroMobile, setHomepageHeroMobile] = useState("/mobile_hero.png");
  const [homepageShowcase1, setHomepageShowcase1] = useState("/vande_bharat.png");
  const [homepageShowcase2, setHomepageShowcase2] = useState("/train_food_delivery.png");
  const [homepagePopularDishes, setHomepagePopularDishes] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem("s_homepage_popular_dishes");
        return stored ? JSON.parse(stored) : [];
      } catch (e) {
        return [];
      }
    }
    return [];
  });
  const [socialInstagram, setSocialInstagram] = useState("https://instagram.com");
  const [socialFacebook, setSocialFacebook] = useState("https://facebook.com");
  const [socialTwitter, setSocialTwitter] = useState("https://twitter.com");
  const [statsPassengers, setStatsPassengers] = useState("5k+");
  const [statsEateries, setStatsEateries] = useState("80+");
  const [statsRating, setStatsRating] = useState("4.8");
  const [statsJunctions, setStatsJunctions] = useState("");
  const [homepageLogo, setHomepageLogo] = useState("/logo-white.png");
  const [homepageLogoWhite, setHomepageLogoWhite] = useState("/logo-white.png");
  const [loading, setLoading] = useState(true);
  const [globalOverrides, setGlobalOverrides] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const local = localStorage.getItem("s_global_overrides");
        return local ? JSON.parse(local) : [];
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  // Database load/save and Supabase sync
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const storedUser = localStorage.getItem("s_user");
        const sessionExpiry = localStorage.getItem("s_session_expiry");

        // Check if 30-day session token has expired
        if (sessionExpiry && Date.now() > Number(sessionExpiry)) {
          console.log("30-day JWT session expired. Automatically logging out.");
          setCurrentUser(null);
          localStorage.removeItem("s_user");
          localStorage.removeItem("s_token");
          localStorage.removeItem("s_session_expiry");
        } else if (storedUser && storedUser !== "undefined") {
          setCurrentUser(JSON.parse(storedUser));
        }
      } catch (e) {
        console.error("Error parsing stored user session:", e);
      }
    }

    if (isSupabaseConfigured()) {
      const syncFromSupabase = async () => {
        try {
          // Fetch critical menu & category data in parallel first
          const [
            stationsDataRes,
            menuDataRes,
            categoriesDataRes,
            overridesDataRes,
            statesDataRes
          ] = await Promise.all([
            supabase.from('stations').select('*'),
            supabase.from('menu_items').select('*'),
            supabase.from('categories').select('*'),
            supabase.from('global_item_overrides').select('*'),
            supabase.from('states').select('*')
          ]);

          if (stationsDataRes.data) {
            setStations(stationsDataRes.data.map(s => ({ ...s, buffer_minutes: Number(s.buffer_minutes) || 60 })));
          }
          if (menuDataRes.data) {
            setMenuItems(menuDataRes.data.map(item => ({ ...item, price: Number(item.price), mrp: Number(item.mrp) })));
          }
          if (categoriesDataRes.data) {
            setCategories(categoriesDataRes.data);
          }
          if (statesDataRes && statesDataRes.data) {
            const loadedStates = statesDataRes.data.map(s => s.name);
            setAvailableStates(loadedStates);
          }
          if (overridesDataRes && overridesDataRes.data && !overridesDataRes.error) {
            setGlobalOverrides(overridesDataRes.data);
            localStorage.setItem("s_global_overrides", JSON.stringify(overridesDataRes.data));
          }
          // Note: If global_item_overrides table doesn't exist yet, overrides fall back to localStorage

          // Toggle loading off immediately after critical data is loaded!
          setLoading(false);

          // Fetch other configurations asynchronously in the background.
          // Note: orders are NOT loaded here — they used to be fetched in full for
          // every visitor via the anon key (a data leak). Admins fetch their scoped
          // orders from /api/admin/orders; customers fetch their own via /api/orders/mine.
          Promise.all([
            supabase.from('config').select('*')
          ]).then(([configRes]) => {
            if (configRes.data) {
              configRes.data.forEach(cfg => {
                const val = typeof cfg.value === 'string' ? cfg.value.trim() : cfg.value;
                const isFalsy = !val || val === 'undefined' || val === 'null' || val === 'none';
                switch (cfg.key) {
                  case 'free_product': setFreeProduct(val); break;
                  case 'cod_policy': setCodPolicy(val); break;
                  case 'cod_cutoff_hour': setCodCutoffHour(Number(val)); break;
                  case 'delivery_charge': setDeliveryCharge(Number(val)); break;
                  case 'gift_threshold': setGiftThreshold(Number(val)); break;
                  case 'support_phone': setSupportPhone(val); break;
                  case 'support_email': setSupportEmail(val); break;
                  case 'homepage_hero_desktop': setHomepageHeroDesktop(prev => (!isFalsy && prev !== val) ? val : prev); break;
                  case 'homepage_hero_mobile': setHomepageHeroMobile(prev => (!isFalsy && prev !== val) ? val : prev); break;
                  case 'homepage_showcase_1': setHomepageShowcase1(prev => (!isFalsy && prev !== val) ? val : prev); break;
                  case 'homepage_showcase_2': setHomepageShowcase2(prev => (!isFalsy && prev !== val) ? val : prev); break;
                  case 'social_instagram': setSocialInstagram(val); break;
                  case 'social_facebook': setSocialFacebook(val); break;
                  case 'social_twitter': setSocialTwitter(val); break;
                  case 'stats_passengers': setStatsPassengers(val); break;
                  case 'stats_eateries': setStatsEateries(val); break;
                  case 'stats_rating': setStatsRating(val); break;
                  case 'stats_junctions': setStatsJunctions(val); break;
                  case 'homepage_logo': setHomepageLogo(prev => (!isFalsy && prev !== val) ? val : prev); break;
                  case 'homepage_logo_white': setHomepageLogoWhite(prev => (!isFalsy && prev !== val) ? val : prev); break;
                  case 'homepage_popular_dishes':
                    try {
                      const parsed = JSON.parse(val);
                      setHomepagePopularDishes(parsed);
                      localStorage.setItem("s_homepage_popular_dishes", JSON.stringify(parsed));
                    } catch (e) { }
                    break;

                  case 'hq_support_contacts':
                    try { setSupportContacts(JSON.parse(val)); } catch (e) { }
                    break;

                  case 'site_faqs':
                    try { setSiteFaqs(JSON.parse(val)); } catch (e) { }
                    break;
                }
              });
            }
          }).catch(err => console.warn("Background config fetch failed:", err));

        } catch (err) {
          console.warn("Supabase load fallback:", err);
          setLoading(false);
        }
      };
      syncFromSupabase();

      // Note: the old anon-key Realtime subscription for orders was removed —
      // it required anon SELECT access on `orders`, which is now locked down.
      // Admins poll /api/admin/orders instead (see fetchAdminOrders below).

      // Set up Realtime WebSockets listener for stations
      const stationsChannel = officialSupabase
        .channel('stations-realtime-channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'stations' }, (payload) => {
          console.log('Realtime Station Event:', payload);
          if (payload.eventType === 'UPDATE') {
            setStations(prev => {
              const updated = prev.map(s => s.id === payload.new.id ? {
                ...s,
                ...payload.new,
                buffer_minutes: Number(payload.new.buffer_minutes) || 60
              } : s);
              localStorage.setItem("s_stations", JSON.stringify(updated));
              return updated;
            });
          } else if (payload.eventType === 'INSERT') {
            setStations(prev => {
              if (prev.some(s => s.id === payload.new.id)) return prev;
              const formatted = {
                ...payload.new,
                buffer_minutes: Number(payload.new.buffer_minutes) || 60
              };
              const updated = [...prev, formatted];
              localStorage.setItem("s_stations", JSON.stringify(updated));
              return updated;
            });
          } else if (payload.eventType === 'DELETE') {
            setStations(prev => {
              const updated = prev.filter(s => s.id !== payload.old.id);
              localStorage.setItem("s_stations", JSON.stringify(updated));
              return updated;
            });
          }
        })
        .subscribe();

      // Poll stations every 5 seconds for real-time fallback
      const pollInterval = setInterval(() => {
        const fetchLatestStations = async () => {
          try {
            const { data: stationsData } = await supabase.from('stations').select('*');
            if (stationsData) {
              const formattedStations = stationsData.map(s => ({
                ...s,
                buffer_minutes: Number(s.buffer_minutes) || 60
              }));
              setStations(prev => {
                const isSame = JSON.stringify(prev) === JSON.stringify(formattedStations);
                if (isSame) return prev;
                localStorage.setItem("s_stations", JSON.stringify(formattedStations));
                return formattedStations;
              });
            }
          } catch (e) {
            console.warn("Poll stations failed:", e);
          }
        };
        fetchLatestStations();
      }, 5000);

      return () => {
        officialSupabase.removeChannel(stationsChannel);
        clearInterval(pollInterval);
      };
    }
  }, []);

  const saveStations = async (newStations) => {
    const previous = stations;
    setStations(newStations);
    localStorage.setItem("s_stations", JSON.stringify(newStations));

    try {
      const res = await fetch('/api/admin/stations/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stations: newStations })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error("Stations sync error:", data.error);
        setStations(previous);
        localStorage.setItem("s_stations", JSON.stringify(previous));
        return { error: data.error || 'Failed to save stations' };
      }
    } catch (err) {
      console.error("Stations sync catch error:", err);
      setStations(previous);
      localStorage.setItem("s_stations", JSON.stringify(previous));
      return { error: 'Network error saving stations' };
    }
    return { error: null };
  };

  const saveMenuItems = async (newMenu) => {
    const previous = menuItems;
    setMenuItems(newMenu);
    localStorage.setItem("s_menu", JSON.stringify(newMenu));

    try {
      const res = await fetch('/api/admin/menu-items/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menuItems: newMenu })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error("Menu items sync error:", data.error);
        setMenuItems(previous);
        localStorage.setItem("s_menu", JSON.stringify(previous));
        return { error: data.error || 'Failed to save menu items' };
      }
    } catch (err) {
      console.error("Menu items sync catch error:", err);
      setMenuItems(previous);
      localStorage.setItem("s_menu", JSON.stringify(previous));
      return { error: 'Network error saving menu items' };
    }
    return { error: null };
  };

  const addOrder = async (order) => {
    const updated = [order, ...orders];
    setOrders(updated);
    localStorage.setItem("s_orders", JSON.stringify(updated));
    if (isSupabaseConfigured()) {
      try {
        const {
          stationCode,
          items,
          onDemandRequests,
          isFreeGiftAdded,
          freeGiftProduct,
          paymentMode,
          paymentId,
          platform,
          ...restOrder
        } = order;

        const payload = {
          ...restOrder,
          stationCode: stationCode,
          items: typeof items !== 'string' ? JSON.stringify(items) : items,
          onDemandRequests: typeof onDemandRequests !== 'string' ? JSON.stringify(onDemandRequests) : onDemandRequests,
          isFreeGiftAdded: !!isFreeGiftAdded,
          freeGiftProduct: freeGiftProduct || null,
          paymentMode: paymentMode || 'COD',
          paymentId: paymentId || null,
          platform: platform || null
        };

        const { error } = await supabase.from('orders').insert([payload]);
        if (error) {
          console.error("Supabase Order Insert Error Detail:", error);
        } else if (order.phone) {
          // Automatically upsert customer record in users table upon successful order placement
          const cleanPhone = String(order.phone).replace(/[^\d+]/g, '');
          await supabase.from('users').upsert({
            phone: cleanPhone,
            last_login: new Date().toISOString()
          }, { onConflict: 'phone' });
        }
      } catch (err) {
        console.error("Supabase Order Insert Catch Error:", err);
      }
    }
  };

  const patchOrder = async (orderId, body) => {
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error('Order update error:', data.error);
        return false;
      }
      return true;
    } catch (err) {
      console.error('Order update catch error:', err);
      return false;
    }
  };

  const updateOrderStatus = async (orderId, status) => {
    const previous = orders;
    setOrders(orders.map(o => o.id === orderId ? { ...o, status } : o));
    const ok = await patchOrder(orderId, { status });
    if (!ok) setOrders(previous);
  };

  const updateOrderRider = async (orderId, riderName) => {
    const previous = orders;
    setOrders(orders.map(o => o.id === orderId ? { ...o, rider_name: riderName } : o));
    const ok = await patchOrder(orderId, { rider_name: riderName });
    if (!ok) setOrders(previous);
  };

  const updateOnDemandStatus = async (orderId, reqIndex, status) => {
    const previous = orders;
    const updated = orders.map(o => {
      if (o.id === orderId) {
        const reqs = [...o.onDemandRequests];
        reqs[reqIndex] = { ...reqs[reqIndex], status };
        return { ...o, onDemandRequests: reqs };
      }
      return o;
    });
    setOrders(updated);
    const targetOrder = updated.find(o => o.id === orderId);
    const ok = await patchOrder(orderId, { onDemandRequests: targetOrder.onDemandRequests });
    if (!ok) setOrders(previous);
  };

  // Admin-side: fetch orders scoped to the logged-in admin's session (global = all,
  // station = their own station). Requires an authenticated Admin-Session cookie.
  const fetchAdminOrders = async () => {
    try {
      const res = await fetch('/api/admin/orders');
      if (!res.ok) return;
      const data = await res.json();
      setOrders((data.orders || []).map(parseOrderObj));
    } catch (err) {
      console.warn('Failed to fetch admin orders:', err);
    }
  };

  // Customer-side: fetch only the given phone's own orders (replaces the old
  // pattern of loading the entire orders table for every visitor).
  const fetchMyOrders = async (phone) => {
    if (!phone) return;
    try {
      const res = await fetch(`/api/orders/mine?phone=${encodeURIComponent(phone)}`);
      if (!res.ok) return;
      const data = await res.json();
      setOrders((data.orders || []).map(parseOrderObj));
    } catch (err) {
      console.warn('Failed to fetch my orders:', err);
    }
  };

  const loginUser = async (phone, idToken = null, daysToKeep = 30) => {
    const cleanPhone = String(phone).replace(/[^\d+]/g, '');
    const expiryTimestamp = Date.now() + (daysToKeep * 24 * 60 * 60 * 1000); // 30 days expiry

    setCurrentUser(cleanPhone);
    localStorage.setItem("s_user", JSON.stringify(cleanPhone));
    localStorage.setItem("s_session_expiry", String(expiryTimestamp));
    if (idToken) {
      localStorage.setItem("s_token", idToken);
    }
    if (isSupabaseConfigured()) {
      // Detects first-time users server-side and pings the admin on WhatsApp.
      // Must finish before the upsert below so the "new user" check isn't raced.
      if (idToken) {
        try {
          await fetch('/api/notify/new-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken })
          });
        } catch (err) {
          console.warn('New-user notify failed:', err);
        }
      }
      try {
        const { error } = await supabase.from('users').upsert({
          phone: cleanPhone,
          last_login: new Date().toISOString()
        }, { onConflict: 'phone' });
        if (error) {
          console.error("Supabase User Upsert Error:", error);
        }
      } catch (err) {
        console.error("Supabase User Upsert Catch Error:", err);
      }
    }
  };

  const logoutUser = () => {
    setCurrentUser(null);
    localStorage.removeItem("s_user");
    localStorage.removeItem("s_token");
    localStorage.removeItem("s_session_expiry");
  };

  // Generic authenticated config key/value setter (global-admin only server-side).
  const saveConfig = async (key, value) => {
    try {
      const res = await fetch('/api/admin/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error(`Config save error (${key}):`, data.error);
      }
    } catch (err) {
      console.error(`Config save catch error (${key}):`, err);
    }
  };

  const updateHomepageHeroDesktop = async (val) => { setHomepageHeroDesktop(val); await saveConfig('homepage_hero_desktop', val); };
  const updateHomepageHeroMobile = async (val) => { setHomepageHeroMobile(val); await saveConfig('homepage_hero_mobile', val); };
  const updateHomepageShowcase1 = async (val) => { setHomepageShowcase1(val); await saveConfig('homepage_showcase_1', val); };
  const updateHomepageShowcase2 = async (val) => { setHomepageShowcase2(val); await saveConfig('homepage_showcase_2', val); };
  const updateHomepagePopularDishes = async (val) => {
    setHomepagePopularDishes(val);
    localStorage.setItem("s_homepage_popular_dishes", JSON.stringify(val));
    await saveConfig('homepage_popular_dishes', JSON.stringify(val));
  };
  const updateSocialInstagram = async (val) => { setSocialInstagram(val); await saveConfig('social_instagram', val); };
  const updateSocialFacebook = async (val) => { setSocialFacebook(val); await saveConfig('social_facebook', val); };
  const updateSocialTwitter = async (val) => { setSocialTwitter(val); await saveConfig('social_twitter', val); };
  const updateStatsPassengers = async (val) => { setStatsPassengers(val); await saveConfig('stats_passengers', val); };
  const updateStatsEateries = async (val) => { setStatsEateries(val); await saveConfig('stats_eateries', val); };
  const updateStatsRating = async (val) => { setStatsRating(val); await saveConfig('stats_rating', val); };
  const updateStatsJunctions = async (val) => { setStatsJunctions(val); await saveConfig('stats_junctions', val); };
  const updateHomepageLogo = async (val) => { setHomepageLogo(val); await saveConfig('homepage_logo', val); };
  const updateHomepageLogoWhite = async (val) => { setHomepageLogoWhite(val); await saveConfig('homepage_logo_white', val); };
  const updateFreeProduct = async (prod) => { setFreeProduct(prod); await saveConfig('free_product', prod); };
  const updateCodPolicy = async (val) => { setCodPolicy(val); await saveConfig('cod_policy', val); };
  const updateCodCutoffHour = async (val) => { const hr = Number(val); setCodCutoffHour(hr); await saveConfig('cod_cutoff_hour', String(hr)); };
  const updateSupportPhone = async (newValue) => { const val = String(newValue).trim(); setSupportPhone(val); await saveConfig('support_phone', val); };
  const updateSupportEmail = async (newValue) => { const val = String(newValue).trim(); setSupportEmail(val); await saveConfig('support_email', val); };
  const updateSupportContacts = async (newList) => { setSupportContacts(newList); await saveConfig('hq_support_contacts', JSON.stringify(newList)); };
  const updateSiteFaqs = async (newList) => { setSiteFaqs(newList); await saveConfig('site_faqs', JSON.stringify(newList)); };
  const updateDeliveryCharge = async (newValue) => { const val = Number(newValue) || 0; setDeliveryCharge(val); await saveConfig('delivery_charge', String(val)); };
  const updateGiftThreshold = async (newValue) => { const val = Number(newValue) || 0; setGiftThreshold(val); await saveConfig('gift_threshold', String(val)); };

  const addAvailableState = async (stateName) => {
    const trimmed = stateName.trim();
    if (!trimmed) return;
    if (availableStates.includes(trimmed)) return;
    const previous = availableStates;
    setAvailableStates([...availableStates, trimmed]);
    try {
      const res = await fetch('/api/admin/states', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed })
      });
      if (!res.ok) setAvailableStates(previous);
    } catch (err) {
      console.error("Error adding state:", err);
      setAvailableStates(previous);
    }
  };

  const removeAvailableState = async (stateName) => {
    const previous = availableStates;
    setAvailableStates(availableStates.filter(s => s !== stateName));
    try {
      const res = await fetch(`/api/admin/states?name=${encodeURIComponent(stateName)}`, { method: 'DELETE' });
      if (!res.ok) setAvailableStates(previous);
    } catch (err) {
      console.error("Error deleting state:", err);
      setAvailableStates(previous);
    }
  };

  const renameAvailableState = async (oldName, newName) => {
    const trimmedNew = newName.trim();
    if (!trimmedNew || trimmedNew === oldName) return;
    const previous = availableStates;
    setAvailableStates(availableStates.map(s => s === oldName ? trimmedNew : s));
    try {
      const res = await fetch('/api/admin/states', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldName, newName: trimmedNew })
      });
      if (!res.ok) setAvailableStates(previous);
    } catch (err) {
      console.error("Error renaming state:", err);
      setAvailableStates(previous);
    }
  };

  const addCategory = async (name, stationCode = 'ALL', image = '') => {
    const code = (stationCode || 'ALL').toUpperCase();
    const exists = categories.some(c => (c.name || '').toLowerCase() === name.toLowerCase() && (c.station_code || 'ALL').toUpperCase() === code);
    if (exists) return { error: 'Category already exists' };

    const newCat = { name, station_code: code, image };
    const previous = categories;
    setCategories([...categories, newCat]);
    try {
      const res = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCat)
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setCategories(previous);
        return { error: data.error || 'Failed to add category' };
      }
    } catch (e) {
      console.error("Error inserting category:", e);
      setCategories(previous);
      return { error: 'Network error adding category' };
    }
    return { error: null };
  };

  const removeCategory = async (name, stationCode = 'ALL') => {
    const code = (stationCode || 'ALL').toUpperCase();
    const previousCats = categories;
    const previousMenu = menuItems;

    setCategories(categories.filter(c => !((c.name || '').toLowerCase() === name.toLowerCase() && (c.station_code || 'ALL').toUpperCase() === code)));
    setMenuItems(menuItems.map(item => {
      const isThisStation = item.station_code && item.station_code.toUpperCase() === code;
      if (isThisStation && item.category === name) return { ...item, category: 'Uncategorized' };
      return item;
    }));

    try {
      const res = await fetch(`/api/admin/categories?name=${encodeURIComponent(name)}&station_code=${encodeURIComponent(code)}`, { method: 'DELETE' });
      if (!res.ok) {
        setCategories(previousCats);
        setMenuItems(previousMenu);
      }
    } catch (e) {
      console.error("Error deleting category:", e);
      setCategories(previousCats);
      setMenuItems(previousMenu);
    }
  };

  const updateCategory = async (oldName, newName, stationCode = 'ALL', image = null) => {
    if (!newName) return;
    const code = (stationCode || 'ALL').toUpperCase();
    const previousCats = categories;
    const previousMenu = menuItems;

    setCategories(categories.map(c => {
      const match = (c.name || '').toLowerCase() === oldName.toLowerCase() && (c.station_code || 'ALL').toUpperCase() === code;
      if (!match) return c;
      const newObj = { ...c, name: newName };
      if (image !== null) newObj.image = image;
      return newObj;
    }));
    setMenuItems(menuItems.map(item => {
      const isThisStation = (item.station_code || 'ALL').toUpperCase() === code;
      if (isThisStation && item.category === oldName) return { ...item, category: newName };
      return item;
    }));

    try {
      const res = await fetch('/api/admin/categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldName, newName, station_code: code, image })
      });
      if (!res.ok) {
        setCategories(previousCats);
        setMenuItems(previousMenu);
      }
    } catch (e) {
      console.error("Error updating category:", e);
      setCategories(previousCats);
      setMenuItems(previousMenu);
    }
  };

  // ─── Global Item Overrides ────────────────────────────────────────────────
  // toggleGlobalItemAvailability: Station admins can toggle global items on/off
  // for their own station without editing the master record.
  const toggleGlobalItemAvailability = async (itemId, stationCode, available) => {
    const code = String(stationCode).toUpperCase();
    const itemStr = String(itemId);

    setGlobalOverrides(prev => {
      const existingIdx = prev.findIndex(
        o => String(o.item_id) === itemStr && String(o.station_code).toUpperCase() === code
      );
      let updated;
      if (existingIdx !== -1) {
        updated = prev.map((o, i) => i === existingIdx ? { ...o, available } : o);
      } else {
        updated = [...prev, { item_id: itemStr, station_code: code, available }];
      }
      localStorage.setItem('s_global_overrides', JSON.stringify(updated));
      return updated;
    });

    try {
      const res = await fetch('/api/admin/overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemStr, station_code: code, available })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error('Error saving global item override:', data.error);
      }
    } catch (e) {
      console.error('Error saving global item override:', e);
    }
  };

  // resolveItemAvailability: Returns effective availability of a menu item for a station.
  // Global items (station_code = 'ALL') check for a station-specific override first.
  const resolveItemAvailability = (item, stationCode) => {
    if (!item.station_code || item.station_code.toUpperCase() !== 'ALL') {
      return item.available !== false;
    }
    const code = String(stationCode || '').toUpperCase();
    const override = globalOverrides.find(
      o => String(o.item_id) === String(item.id) && String(o.station_code).toUpperCase() === code
    );
    if (override !== undefined) return override.available !== false;
    return item.available !== false;
  };

  // Dynamically compute disableCod based on selected policy
  const disableCod = codPolicy === 'always_disable' ||
    (codPolicy === 'disable_after_hour' && new Date().getHours() >= Number(codCutoffHour));

  return (
    <AppContext.Provider value={{
      stations,
      setStations: saveStations,
      menuItems,
      setMenuItems: saveMenuItems,
      orders,
      addOrder,
      updateOrderStatus,
      updateOrderRider,
      updateOnDemandStatus,
      fetchAdminOrders,
      fetchMyOrders,
      currentUser,
      loginUser,
      logoutUser,
      freeProduct,
      updateFreeProduct,
      disableCod,
      codPolicy,
      updateCodPolicy,
      codCutoffHour,
      updateCodCutoffHour,
      availableStates,
      addAvailableState,
      removeAvailableState,
      renameAvailableState,
      deliveryCharge,
      updateDeliveryCharge,
      giftThreshold,
      updateGiftThreshold,
      supportPhone,
      updateSupportPhone,
      supportEmail,
      updateSupportEmail,
      supportContacts,
      updateSupportContacts,
      siteFaqs,
      updateSiteFaqs,
      categories,
      addCategory,
      removeCategory,
      updateCategory,
      homepageHeroDesktop,
      updateHomepageHeroDesktop,
      homepageHeroMobile,
      updateHomepageHeroMobile,
      homepageShowcase1,
      updateHomepageShowcase1,
      homepageShowcase2,
      updateHomepageShowcase2,
      homepagePopularDishes,
      updateHomepagePopularDishes,
      socialInstagram,
      updateSocialInstagram,
      socialFacebook,
      updateSocialFacebook,
      socialTwitter,
      updateSocialTwitter,
      statsPassengers,
      updateStatsPassengers,
      statsEateries,
      updateStatsEateries,
      statsRating,
      updateStatsRating,
      statsJunctions,
      updateStatsJunctions,
      homepageLogo,
      updateHomepageLogo,
      homepageLogoWhite,
      updateHomepageLogoWhite,
      globalOverrides,
      toggleGlobalItemAvailability,
      resolveItemAvailability,
      loading
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
