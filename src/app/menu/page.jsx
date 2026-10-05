"use client";
import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useApp } from '../../context/AppContext';
import {
  ShoppingCart, ShoppingBag, Plus, Minus, Trash2, HeartHandshake, Gift,
  MapPin, Search, Sparkles, Check, Info, Utensils, ShieldCheck, Flame, Coffee, Pizza,
  Train, BellRing, Compass, Ticket, Tag, X, IndianRupee, ArrowLeft, Calendar, Cookie,
  ChevronLeft, ChevronRight
} from 'lucide-react';

/* ── Inline railway-track SVG divider ── */
function TrackDivider({ light = false }) {
  const rail = light ? "#cbd5e1" : "#e2e8f0";
  const sleeper = light ? "#94a3b8" : "#cbd5e1";
  return (
    <div className="w-full overflow-hidden py-3 select-none pointer-events-none" aria-hidden>
      <svg viewBox="0 0 800 12" className="w-full h-3" preserveAspectRatio="none">
        <rect y="3" width="800" height="2" fill={rail} rx="1" />
        <rect y="7" width="800" height="2" fill={rail} rx="1" />
        {Array.from({ length: 50 }).map((_, i) => (
          <rect key={i} x={i * 16} y="1" width="8" height="10" rx="1" fill={sleeper} />
        ))}
      </svg>
    </div>
  );
}

function MenuContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stationCode = searchParams.get('station') || '';
  const categoryScrollRef = React.useRef(null);

  const scrollCategories = (direction) => {
    if (categoryScrollRef.current) {
      const scrollAmount = 150;
      categoryScrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };
  const pnr = searchParams.get('pnr') || '';
  const arrTime = searchParams.get('arrTime') || '';
  const trainName = searchParams.get('trainName') || '';
  const trainNumber = searchParams.get('trainNumber') || '';

  const { menuItems, stations, freeProduct, deliveryCharge, giftThreshold, categories, loading, resolveItemAvailability } = useApp();
  const [selectedStation, setSelectedStation] = useState(null);
  const [cart, setCart] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [foodTypeFilter, setFoodTypeFilter] = useState('all'); // 'all', 'veg', 'nonveg'
  const [searchQuery, setSearchQuery] = useState('');
  const [isClosed, setIsClosed] = useState(false);
  const [stationPickerItem, setStationPickerItem] = useState(null);
  const [cutoffBufferUsed, setCutoffBufferUsed] = useState(60);
  const [trainNo, setTrainNo] = useState('');
  const [tName, setTName] = useState('');
  const [liveEta, setLiveEta] = useState(null);
  const [liveDelay, setLiveDelay] = useState(null);
  const [lastUpdated, setLastUpdated] = useState('');

  const activeArrTime = liveEta || arrTime;

  // Live Train Tracking Fetcher
  useEffect(() => {
    const tNo = trainNumber || (typeof window !== 'undefined' ? localStorage.getItem("checkout_train_number") : '') || '';
    const name = trainName || (typeof window !== 'undefined' ? localStorage.getItem("checkout_train_name") : '') || '';
    setTrainNo(tNo);
    setTName(name);

    const isValidTrainNo = (num) => {
      if (!num) return false;
      const clean = String(num).trim();
      return clean !== '' && clean !== 'N/A' && clean !== 'null' && /^\d+$/.test(clean);
    };

    if (isValidTrainNo(tNo) && stationCode) {
      const fetchLiveTime = async () => {
        try {
          const dateParam = (typeof window !== 'undefined' ? localStorage.getItem("checkout_doj") : '') || 'today';
          const res = await fetch(`/api/track-train?trainNo=${tNo}&date=${dateParam}`);
          if (res.ok) {
            const apiData = await res.json();
            if (apiData.success && apiData.data?.lastUpdate) {
              setLastUpdated(apiData.data.lastUpdate);
            }
            const stationsArray = apiData.data?.timeline || apiData.data?.stations || [];
            const matchedStop = stationsArray.find(s => (s.stationCode || s.code || '').toUpperCase() === stationCode.toUpperCase());
            if (matchedStop) {
              const rawActual = matchedStop.arrival?.actual || matchedStop.departure?.actual;
              const rawScheduled = matchedStop.arrival?.scheduled || matchedStop.departure?.scheduled;

              const cleanTimeStr = (rawStr) => {
                if (!rawStr) return null;
                const timeMatch = String(rawStr).match(/([0-9]{2}:[0-9]{2})/);
                return timeMatch ? timeMatch[1] : null;
              };

              const actualTime = cleanTimeStr(rawActual) || cleanTimeStr(rawScheduled);
              if (actualTime) {
                setLiveEta(actualTime);
              }
              const rawDelay = matchedStop.arrival?.delay || matchedStop.departure?.delay || "0";
              const delayVal = parseInt(String(rawDelay).replace(/[^0-9]/g, '')) || 0;
              setLiveDelay(delayVal > 0 ? `Late by ${delayVal} mins` : "Right Time");
            }
          }
        } catch (e) {
          console.warn("Error fetching live tracking for station on menu page:", e);
        }
      };
      fetchLiveTime();
    }
  }, [trainNumber, trainName, stationCode]);

  // On-demand custom request inputs
  const [onDemandItems, setOnDemandItems] = useState([
    { name: 'Warm Blanket', price: 50, checked: false, description: 'Freshly washed warm blanket delivered to your berth.' },
    { name: 'Emergency Medical Kit', price: 120, checked: false, description: 'Essential emergency medicines, painkillers, and bandages.' },
    { name: 'Warm Drinking Water', price: 0, checked: false, description: 'Thermos flask containing hot water for kids/elderly.' }
  ]);
  const [customOnDemand, setCustomOnDemand] = useState('');
  const [variantSelectModalItem, setVariantSelectModalItem] = useState(null);
  const [showCartDrawer, setShowCartDrawer] = useState(false);
  const [stationSearchQuery, setStationSearchQuery] = useState('');
  const [showHubDropdown, setShowHubDropdown] = useState(false);
  const [hubSearchQuery, setHubSearchQuery] = useState('');

  const getClosedReason = () => {
    if (selectedStation) {
      if (selectedStation.is_active === false) {
        return "Kitchen Suspended: Sorry, food ordering is temporarily suspended by the kitchen manager at this station.";
      }

      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const currentTimeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;
      const openTime = selectedStation.open_time || '00:00';
      const closeTime = selectedStation.close_time || '23:59';

      const isTimeInWindow = (current, open, close) => {
        if (open === close) return true;
        if (open < close) {
          return current >= open && current <= close;
        } else {
          return current >= open || current <= close;
        }
      };

      if (!isTimeInWindow(currentTimeStr, openTime, closeTime)) {
        return `Closed Hours: Sorry, the kitchen at this station operates between ${openTime} and ${closeTime}. Current time is outside operation hours.`;
      }
    }
    return `Delivery Cutoff Reached: Sorry! Kitchen has stopped accepting orders for this hub because the train is scheduled to arrive in less than ${cutoffBufferUsed} minutes (or has already departed).`;
  };

  // Fetch station details
  useEffect(() => {
    if (stationCode) {
      const found = stations.find(s => s.code.toLowerCase() === stationCode.toLowerCase());
      if (found) setSelectedStation(found);
    } else {
      setSelectedStation(null);
    }
  }, [stationCode, stations]);

  // Keep active category null by default to show categories browse grid first,
  // but only when stationCode is explicitly cleared (switching back to browse mode)
  useEffect(() => {
    if (!stationCode) {
      setActiveCategory(null);
    }
  }, [stationCode]);

  // Check station cutoff buffer time and status
  useEffect(() => {
    if (selectedStation) {
      if (selectedStation.is_active === false) {
        setIsClosed(true);
        return;
      }

      // Check operation hours
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const currentTimeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;

      const openTime = selectedStation.open_time || '00:00';
      const closeTime = selectedStation.close_time || '23:59';

      const isTimeInWindow = (current, open, close) => {
        if (open === close) return true;
        if (open < close) {
          return current >= open && current <= close;
        } else {
          // Overnight window (e.g. 10:00 AM to 02:00 AM next day)
          return current >= open || current <= close;
        }
      };

      console.log("DEBUG STATION TIMING WINDOW:", {
        station: selectedStation.name,
        isActive: selectedStation.is_active,
        openTime,
        closeTime,
        currentTimeStr,
        inWindow: isTimeInWindow(currentTimeStr, openTime, closeTime)
      });

      if (!isTimeInWindow(currentTimeStr, openTime, closeTime)) {
        setIsClosed(true);
        return;
      }

      // Buffer cutoff check
      if (activeArrTime) {
        const bufferMins = selectedStation.buffer_minutes || 60;
        setCutoffBufferUsed(bufferMins);

        const isBookingClosed = (arrivalTimeStr, bufferLimit) => {
          if (!arrivalTimeStr || arrivalTimeStr === '--:--') return false;
          try {
            const [arrHrs, arrMins] = arrivalTimeStr.split(':').map(Number);
            let arrDate = new Date();

            const savedDoj = typeof window !== 'undefined' ? localStorage.getItem("checkout_doj") : '';
            if (savedDoj) {
              let parsedDOJ = null;
              if (savedDoj.includes('-')) {
                const parts = savedDoj.split('-');
                if (parts.length === 3) {
                  if (parts[0].length === 4) {
                    parsedDOJ = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
                  } else {
                    parsedDOJ = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
                  }
                }
              }
              if (!parsedDOJ || isNaN(parsedDOJ.getTime())) {
                parsedDOJ = new Date(savedDoj);
              }
              if (parsedDOJ && !isNaN(parsedDOJ.getTime())) {
                arrDate = parsedDOJ;
              }
            }
            arrDate.setHours(arrHrs, arrMins, 0, 0);

            let diffMs = arrDate.getTime() - now.getTime();
            if (diffMs < 0 && Math.abs(diffMs) < 24 * 60 * 60 * 1000) {
              arrDate.setDate(arrDate.getDate() + 1);
              diffMs = arrDate.getTime() - now.getTime();
            }
            const diffMins = Math.floor(diffMs / 60000);
            console.log("DEBUG CUTOFF MINUTES CALCULATION:", {
              now: now.toISOString(),
              arrDate: arrDate.toISOString(),
              diffMins,
              bufferLimit,
              isClosedResult: diffMins < bufferLimit
            });
            return diffMins < bufferLimit;
          } catch (e) {
            console.error("isBookingClosed parsing error:", e);
            return false;
          }
        };

        if (isBookingClosed(activeArrTime, bufferMins)) {
          setIsClosed(true);
          return;
        }
      }
      setIsClosed(false);
    }
  }, [selectedStation, activeArrTime]);

  // Client-Side Countdown Timer State & Hook
  const [timeLeftStr, setTimeLeftStr] = useState('');

  useEffect(() => {
    if (!selectedStation || !activeArrTime || isClosed) return;

    const calculateCountdown = () => {
      const bufferMins = selectedStation.buffer_minutes || 60;
      const now = new Date();
      const [arrHrs, arrMins] = activeArrTime.split(':').map(Number);
      let arrDate = new Date();

      const savedDoj = localStorage.getItem("checkout_doj") || '';
      if (savedDoj) {
        let parsedDOJ = null;
        if (savedDoj.includes('-')) {
          const parts = savedDoj.split('-');
          if (parts.length === 3) {
            if (parts[0].length === 4) {
              parsedDOJ = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
            } else {
              parsedDOJ = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
            }
          }
        }
        if (!parsedDOJ || isNaN(parsedDOJ.getTime())) {
          parsedDOJ = new Date(savedDoj);
        }
        if (parsedDOJ && !isNaN(parsedDOJ.getTime())) {
          arrDate = parsedDOJ;
        }
      }
      arrDate.setHours(arrHrs, arrMins, 0, 0);

      let diffMs = arrDate.getTime() - now.getTime();
      if (diffMs < 0 && Math.abs(diffMs) < 24 * 60 * 60 * 1000) {
        arrDate.setDate(arrDate.getDate() + 1);
      }

      // Cutoff time = expected arrival - buffer minutes
      const cutoffTime = new Date(arrDate.getTime() - bufferMins * 60000);
      const cutoffDiffMs = cutoffTime.getTime() - now.getTime();

      if (cutoffDiffMs <= 0) {
        setIsClosed(true);
        setTimeLeftStr('Ordering Closed');
        return false;
      }

      const totalSecs = Math.floor(cutoffDiffMs / 1000);
      const hrs = Math.floor(totalSecs / 3600);
      const mins = Math.floor((totalSecs % 3600) / 60);
      const secs = totalSecs % 60;

      // Dynamic Display String according to specifications
      if (totalSecs > 7200) { // More than 2 hours left
        // Format cutoffTime as HH:MM AM/PM
        const timeStr = cutoffTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setTimeLeftStr(`Place order before ${timeStr}`);
      } else {
        // Less than 2 hours left: show active countdown timer
        let displayStr = '';
        if (hrs > 0) {
          displayStr += `${String(hrs).padStart(2, '0')}:`;
        }
        displayStr += `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        setTimeLeftStr(displayStr);
      }
      return true;
    };

    const hasTime = calculateCountdown();
    if (!hasTime) return;

    const timer = setInterval(() => {
      const active = calculateCountdown();
      if (!active) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [selectedStation, activeArrTime, isClosed]);

  // Load cart from LocalStorage
  useEffect(() => {
    const savedCart = localStorage.getItem("s_cart");
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart));
      } catch (e) {
        console.warn("Failed to parse saved cart:", e);
      }
    }
  }, []);

  // Automatically add item to cart from URL search parameter (e.g. popular dishes homepage redirection)
  useEffect(() => {
    if (loading || !menuItems || menuItems.length === 0) return;
    const addItemName = searchParams.get('add_item');
    if (addItemName) {
      const matched = menuItems.find(item => item.name.toLowerCase().trim() === addItemName.toLowerCase().trim());
      if (matched) {
        // Clean URL parameter so it doesn't add multiple times on page refreshes
        const url = new URL(window.location.href);
        url.searchParams.delete('add_item');
        window.history.replaceState({}, '', url.pathname + url.search);

        // Add to cart
        addToCart(matched);
      }
    }
  }, [searchParams, menuItems, loading]);

  const saveCart = (updatedCart) => {
    setCart(updatedCart);
    localStorage.setItem("s_cart", JSON.stringify(updatedCart));
  };

  const addToCart = (item, selectedVariant = null, overrideStationCode = null) => {
    const effectiveStationCode = overrideStationCode || stationCode;
    if (!effectiveStationCode) {
      setStationPickerItem(item);
      return;
    }

    if (item.variants && item.variants.length > 0 && !selectedVariant) {
      setVariantSelectModalItem(item);
      return;
    }

    const productId = selectedVariant ? `${item.id}_${selectedVariant.name.replace(/\s+/g, '')}` : item.id;
    const productName = selectedVariant ? `${item.name} (${selectedVariant.name})` : item.name;
    const productPrice = selectedVariant ? selectedVariant.price : item.price;

    const cartItem = {
      id: productId,
      name: productName,
      price: Number(productPrice),
      mrp: Number(productPrice),
      category: item.category,
      image_url: item.image_url || item.image
    };

    const existing = cart.find(c => c.id === cartItem.id);
    if (existing) {
      const updated = cart.map(c => c.id === cartItem.id ? { ...c, quantity: c.quantity + 1 } : c);
      saveCart(updated);
    } else {
      const updated = [...cart, { ...cartItem, quantity: 1 }];
      saveCart(updated);
    }
  };

  const removeFromCart = (itemId) => {
    const existing = cart.find(c => c.id === itemId);
    if (!existing) return;
    if (existing.quantity === 1) {
      const updated = cart.filter(c => c.id !== itemId);
      saveCart(updated);
    } else {
      const updated = cart.map(c => c.id === itemId ? { ...c, quantity: c.quantity - 1 } : c);
      saveCart(updated);
    }
  };

  const clearCart = () => {
    saveCart([]);
  };

  const updateCartItemQuantity = (itemId, newQty) => {
    if (newQty <= 0) {
      const updated = cart.filter(c => c.id !== itemId);
      saveCart(updated);
    } else {
      const updated = cart.map(c => c.id === itemId ? { ...c, quantity: newQty } : c);
      saveCart(updated);
    }
  };

  // Cart total calculations
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const activeDeliveryFee = subtotal > 0 ? (Number(deliveryCharge) || 0) : 0;
  const total = subtotal + activeDeliveryFee;

  // On-demand selected items
  const selectedOnDemand = onDemandItems.filter(i => i.checked);

  const handleCheckoutProceed = () => {
    if (cart.length === 0) {
      alert("Your cart is empty! Please select some food items.");
      return;
    }

    // Read resolved train details from localStorage as fallbacks
    const resolvedName = trainName || localStorage.getItem("checkout_train_name") || 'N/A';
    const resolvedNumber = trainNumber || localStorage.getItem("checkout_train_number") || 'N/A';

    localStorage.setItem("checkout_subtotal", subtotal.toString());
    localStorage.setItem("checkout_delivery", activeDeliveryFee.toString());
    localStorage.setItem("checkout_total", total.toString());
    localStorage.setItem("checkout_train_name", resolvedName);
    localStorage.setItem("checkout_train_number", resolvedNumber);
    localStorage.setItem("checkout_arr_time", arrTime);

    const onDemandPayload = [
      ...selectedOnDemand.map(item => ({ name: item.name, price: item.price, status: 'Pending' })),
      ...(customOnDemand.trim() ? [{ name: `Alert: ${customOnDemand}`, price: 0, status: 'Pending' }] : [])
    ];
    localStorage.setItem("checkout_ondemand", JSON.stringify(onDemandPayload));

    router.push(`/checkout?station=${stationCode}&pnr=${pnr}&arrTime=${encodeURIComponent(arrTime)}&trainName=${encodeURIComponent(resolvedName)}&trainNumber=${encodeURIComponent(resolvedNumber)}`);
  };

  // Consolidate menuItems by name if no stationCode is selected
  const consolidatedMenuItems = React.useMemo(() => {
    if (!menuItems) return [];
    if (stationCode) {
      // Station-specific items + global items (station_code = 'ALL')
      const stationItems = menuItems.filter(item =>
        item.station_code && item.station_code.toLowerCase() === stationCode.toLowerCase()
      ).map(item => ({
        ...item,
        available: resolveItemAvailability ? resolveItemAvailability(item, stationCode) : item.available !== false
      }));
      const globalItems = menuItems.filter(item =>
        !item.station_code || item.station_code.toUpperCase() === 'ALL'
      );
      // Merge: station-specific items take priority over global ones with the same name
      const stationNameKeys = new Set(stationItems.map(i => i.name.toLowerCase().trim()));
      const globalFiltered = globalItems.filter(
        g => !stationNameKeys.has(g.name.toLowerCase().trim())
      );
      // Map global items to include effective availability
      const globalWithEffective = globalFiltered.map(item => ({
        ...item,
        available: resolveItemAvailability ? resolveItemAvailability(item, stationCode) : item.available !== false
      }));
      return [...stationItems, ...globalWithEffective];
    }

    // De-duplicate items by name
    const uniqueMap = new Map();
    menuItems.forEach(item => {
      const nameKey = item.name.toLowerCase().trim();
      if (!uniqueMap.has(nameKey)) {
        uniqueMap.set(nameKey, item);
      }
    });
    return Array.from(uniqueMap.values());
  }, [menuItems, stationCode, resolveItemAvailability]);

  const getStationsForItem = React.useCallback((itemName) => {
    if (!menuItems) return [];
    const nameKey = itemName.toLowerCase().trim();
    const matchedItems = menuItems.filter(item => item.name.toLowerCase().trim() === nameKey);

    let result = [];
    matchedItems.forEach(item => {
      const isGlobal = !item.station_code || item.station_code.toUpperCase() === 'ALL';
      if (isGlobal) {
        // If it's a global item, it is served at all stations unless overridden
        stations.forEach(stn => {
          const isAvailableAtStation = resolveItemAvailability ? resolveItemAvailability(item, stn.code) : true;
          result.push({
            ...item,
            station_code: stn.code,
            stationName: stn.name,
            stationState: stn.state,
            inStock: isAvailableAtStation
          });
        });
      } else {
        const stn = stations.find(s => s.code.toLowerCase() === item.station_code.toLowerCase());
        if (stn) {
          const isAvailableAtStation = resolveItemAvailability ? resolveItemAvailability(item, stn.code) : item.available !== false;
          result.push({
            ...item,
            stationName: stn.name,
            stationState: stn.state,
            inStock: isAvailableAtStation
          });
        }
      }
    });

    // De-duplicate stations by code (prioritizing in-stock ones if duplicates exist)
    const uniqueStationsMap = new Map();
    result.forEach(r => {
      const key = r.station_code.toUpperCase();
      const existing = uniqueStationsMap.get(key);
      if (!existing || (!existing.inStock && r.inStock)) {
        uniqueStationsMap.set(key, r);
      }
    });
    return Array.from(uniqueStationsMap.values());
  }, [menuItems, stations, resolveItemAvailability]);

  const handleSelectStationForItem = (targetStationCode, targetItem) => {
    setStationPickerItem(null);
    localStorage.setItem("selected_station_code", targetStationCode);
    const params = new URLSearchParams(window.location.search);
    params.set('station', targetStationCode);
    router.push(`${window.location.pathname}?${params.toString()}`);

    const actualItem = menuItems.find(
      mi => mi.name.toLowerCase().trim() === targetItem.name.toLowerCase().trim() &&
        mi.station_code?.toLowerCase() === targetStationCode.toLowerCase()
    ) || menuItems.find(
      mi => mi.name.toLowerCase().trim() === targetItem.name.toLowerCase().trim() &&
        (!mi.station_code || mi.station_code.toUpperCase() === 'ALL')
    );

    if (actualItem) {
      setTimeout(() => {
        addToCart(actualItem, null, targetStationCode);
      }, 50);
    }
  };

  // Filter Menu list
  const filteredMenu = React.useMemo(() => {
    if (!consolidatedMenuItems) return [];

    return consolidatedMenuItems.filter(item => {
      const matchesCategory = activeCategory === 'All' || item.category === activeCategory;
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase());

      // Veg/Non-Veg filter matching
      const isVeg = item.food_type
        ? (item.food_type === 'veg')
        : (!item.name.toLowerCase().includes('chicken') &&
          !item.name.toLowerCase().includes('mutton') &&
          !item.name.toLowerCase().includes('non veg') &&
          !item.name.toLowerCase().includes('non-veg') &&
          !item.name.toLowerCase().includes('meat') &&
          !item.name.toLowerCase().includes('egg') &&
          !item.name.toLowerCase().includes('fish'));

      let matchesFoodType = true;
      if (foodTypeFilter === 'veg') {
        matchesFoodType = isVeg && item.food_type !== '';
      } else if (foodTypeFilter === 'nonveg') {
        matchesFoodType = !isVeg && item.food_type !== '';
      } else if (foodTypeFilter === 'standard') {
        matchesFoodType = item.food_type === '';
      }

      return matchesCategory && matchesSearch && matchesFoodType;
    });
  }, [consolidatedMenuItems, activeCategory, searchQuery, foodTypeFilter]);

  // Get active categories for this station dynamically
  const stationCategories = React.useMemo(() => {
    if (!categories) return [];

    const stationSpecific = categories.filter(
      cat => cat.station_code && cat.station_code.toUpperCase() === stationCode.toUpperCase()
    );

    const targetCats = stationSpecific.length > 0
      ? stationSpecific
      : categories.filter(cat => !cat.station_code || cat.station_code.toUpperCase() === 'ALL');

    const names = targetCats.map(cat => {
      return cat.name.includes(':') ? cat.name.split(':')[1] : cat.name;
    });

    return Array.from(new Set(names));
  }, [categories, stationCode]);

  const isCartVisible = activeCategory !== null || cart.length > 0;

  // Helper to render Category Icons
  const getCategoryIcon = (category) => {
    switch (category) {
      case 'All': return <Sparkles className="w-4 h-4" />;
      case 'Meals': return <Pizza className="w-4 h-4" />;
      case 'Fast Food': return <Flame className="w-4 h-4" />;
      case 'Snacks': return <Cookie className="w-4 h-4" />;
      case 'Drinks': return <Coffee className="w-4 h-4" />;
      default: return <Utensils className="w-4 h-4" />;
    }
  };

  const getCategoryCount = (category) => {
    if (!consolidatedMenuItems) return 0;
    const availableItems = consolidatedMenuItems.filter(item => item.available);

    if (category === 'All') {
      return availableItems.length;
    }
    return availableItems.filter(item => item.category === category).length;
  };

  const getCategoryColor = (category, isActive) => {
    if (!isActive) return 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300 hover:bg-slate-50/70 hover:shadow-sm';

    switch (category) {
      case 'All':
        return 'bg-gradient-to-r from-violet-600 to-indigo-600 border-transparent text-white shadow-md shadow-indigo-600/25';
      case 'Meals':
        return 'bg-gradient-to-r from-amber-500 to-orange-500 border-transparent text-white shadow-md shadow-orange-500/25';
      case 'Fast Food':
        return 'bg-gradient-to-r from-red-600 to-rose-500 border-transparent text-white shadow-md shadow-red-500/25';
      case 'Snacks':
        return 'bg-gradient-to-r from-yellow-500 to-amber-500 border-transparent text-white shadow-md shadow-amber-500/25';
      case 'Drinks':
        return 'bg-gradient-to-r from-blue-500 to-cyan-500 border-transparent text-white shadow-md shadow-blue-500/25';
      default:
        return 'bg-gradient-to-r from-rose-600 to-pink-500 border-transparent text-white shadow-md shadow-rose-600/25';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-4 border-slate-100" />
          <div className="absolute inset-0 rounded-full border-4 border-rose-600 border-t-transparent animate-spin" />
        </div>
        <div className="text-center space-y-1">
          <h3 className="font-black text-slate-800 text-base tracking-tight uppercase">Loading Pantry Menu</h3>
          <p className="text-sm text-slate-400 font-semibold">Connecting to station kitchen databases...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${arrTime ? 'pt-[105px]' : 'pt-[65px]'} md:pt-8 pb-[117px] md:pb-8 min-h-screen bg-gradient-to-br from-slate-50 via-rose-50/10 to-slate-50 relative`}>
      <style dangerouslySetInnerHTML={{
        __html: `
        .scrollbar-none::-webkit-scrollbar {
          display: none !important;
        }
        .scrollbar-none {
          -ms-overflow-style: none !important;
          scrollbar-width: none !important;
        }
        .sticky-category-header {
          position: -webkit-sticky;
          position: sticky;
          z-index: 30;
          background: rgba(250, 250, 250, 0.9);
          backdrop-filter: blur(8px);
          padding-top: 0.75rem;
          padding-bottom: 0.75rem;
          margin-top: -0.5rem;
          top: ${arrTime ? '88px' : '52px'};
          border-bottom: 1px solid rgba(226, 232, 240, 0.6);
        }
        @media (min-width: 768px) {
          .sticky-category-header {
            top: 64px;
            background: rgba(250, 250, 250, 0.95);
            padding-top: 1rem;
            padding-bottom: 1rem;
          }
        }
      `}} />

      {/* 📱 Mobile Sticky Top Navbar (Visible only on mobile) */}
      <div className="md:hidden bg-white border-b border-slate-200 px-3 py-2.5 shadow-xs fixed top-0 left-0 right-0 z-50 flex flex-col gap-2 w-full font-sans">
        {/* Row 1: Back Button, Station Name, Code, and State/Delivery Badge */}
        <div className="flex items-center gap-2.5 w-full">
          <Link
            href="/"
            className="p-2 hover:bg-slate-100 rounded-xl text-slate-655 hover:text-slate-800 transition-colors shrink-0 flex items-center justify-center border border-slate-205"
          >
            <ArrowLeft className="w-4 h-4 text-slate-707" />
          </Link>

          <div className="flex-1 min-w-0 flex flex-col">
            <h1 className="text-base font-black text-slate-900 leading-tight flex items-center gap-1.5">
              <span className="truncate">{selectedStation ? selectedStation.name : 'Station Hub'}</span>
              <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px] font-mono uppercase border border-slate-200 shrink-0">
                {stationCode || 'N/A'}
              </span>
            </h1>
            {selectedStation?.state && (
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block mt-0.5">
                {selectedStation.state}
              </span>
            )}
          </div>

          {/* Delivery Badge */}
          <div className="shrink-0">
            {pnr ? (
              <div className="bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-lg text-right shadow-xs">
                <span className="text-[8px] text-slate-400 font-extrabold uppercase tracking-wider block">PNR</span>
                <span className="font-mono text-[9px] font-black text-slate-808 tracking-wider block">{pnr}</span>
              </div>
            ) : (
              <div className="bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg text-center shadow-xs flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-[9px] text-emerald-800 font-black uppercase tracking-wider">Direct Delivery</span>
              </div>
            )}
          </div>
        </div>

        {/* Row 2: Train Timings & Cutoff Time */}
        {arrTime && (
          <div className="flex flex-wrap gap-1.5 items-center justify-start border-t border-slate-100 pt-2 w-full">
            <span className="text-slate-500 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded text-[9px] font-bold">
              SCH: {arrTime}
            </span>
            <span className="text-rose-655 bg-rose-50 border border-rose-150 px-1.5 py-0.5 rounded text-[9px] font-black uppercase">
              LIVE ETA: {activeArrTime}
            </span>
            {liveDelay && liveDelay !== 'Right Time' && (
              <span className="text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded text-[9px] font-black uppercase">
                ⚠️ {liveDelay}
              </span>
            )}
            {timeLeftStr && (
              <span className={`px-1.5 py-0.5 rounded uppercase text-[9px] font-black tracking-wider flex items-center gap-0.5 border ml-auto ${isClosed ? 'bg-red-50 text-red-600 border-red-100 animate-pulse' : 'bg-amber-50 text-amber-800 border-amber-200/60'
                }`}>
                ⏱ {isClosed ? 'Ordering Closed' : (timeLeftStr.startsWith('Place') ? timeLeftStr : `Closes: ${timeLeftStr}`)}
              </span>
            )}
          </div>
        )}
      </div>

      {/* 💻 Desktop Station Header Card (Visible only on desktop/tablets) */}
      <div className="hidden md:flex bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm mb-8 relative overflow-hidden flex-col md:flex-row md:items-center md:justify-between gap-6">
        {/* Background ambient glow */}
        <div className="absolute top-[-50px] right-[-50px] w-48 h-48 bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-start gap-4 flex-1">
          <div className="bg-rose-50 text-rose-600 p-3.5 rounded-2xl border border-rose-100 shrink-0 shadow-xs">
            <Train className="w-6 h-6 text-rose-600" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">
              {selectedStation ? selectedStation.name : 'Station Hub'}
            </h1>
            <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500 font-bold">
              <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono uppercase border border-slate-200">
                {stationCode || 'N/A'}
              </span>
              {selectedStation && (
                <span className="text-slate-400">
                  • {selectedStation.state}
                </span>
              )}
              {arrTime && (
                <div className="flex flex-wrap gap-1.5 items-center ml-1">
                  <span className="text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded uppercase font-semibold">
                    SCH: {arrTime}
                  </span>
                  <span className="text-rose-600 bg-rose-50 border border-rose-150 px-2 py-0.5 rounded uppercase font-black">
                    LIVE ETA: {activeArrTime}
                  </span>
                  {liveDelay && liveDelay !== 'Right Time' && (
                    <span className="text-amber-700 bg-amber-50 border border-amber-250 px-2 py-0.5 rounded uppercase font-black">
                      ⚠️ {liveDelay}
                    </span>
                  )}
                  {lastUpdated && (
                    <span className="text-slate-400 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded uppercase font-bold text-[10px]">
                      Live Status: {lastUpdated}
                    </span>
                  )}
                </div>
              )}
              {timeLeftStr && (
                <span className={`px-2.5 py-0.5 rounded uppercase font-black text-[10px] tracking-wider flex items-center gap-1 border ${isClosed ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-550/10 text-amber-800 border-amber-500/20'
                  }`}>
                  ⏱ {isClosed ? 'Ordering Closed' : (timeLeftStr.startsWith('Place') ? timeLeftStr : `Order Closes in: ${timeLeftStr}`)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* PNR Details / Delivery Status Badge */}
        <div className="shrink-0 flex items-center">
          {pnr ? (
            <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl text-left min-w-[180px] shadow-xs">
              <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block">PASSENGER PNR</span>
              <span className="font-mono text-base font-black text-slate-800 tracking-wider block mt-0.5">{pnr}</span>
            </div>
          ) : (
            <div className="bg-emerald-50/60 border border-emerald-200 p-3 rounded-2xl text-left min-w-[180px] shadow-xs">
              <span className="text-[9px] text-emerald-800 font-black uppercase tracking-wider block">Delivery Status</span>
              <span className="text-sm font-bold text-emerald-800 block mt-0.5">Direct Station Delivery</span>
            </div>
          )}
        </div>
      </div>

      {/* Railway Track divider */}
      <TrackDivider light />

      {/* MRP Packaged Items Info Banner */}
      <div className="w-fit max-w-full bg-amber-50 border border-amber-200 rounded-2xl p-3 mb-6 text-sm sm:text-base text-amber-900 font-bold flex items-center gap-3 shadow-xs">
        <span className="bg-amber-550/10 text-amber-600 p-2 sm:p-2.5 rounded-xl shrink-0 flex items-center justify-center">
          <Tag className="w-4 h-4 sm:w-5 sm:h-5" />
        </span>
        <div className="text-sm sm:text-base leading-snug">
          <span className="font-extrabold text-amber-950 mr-1.5">Packaged Items:</span>
          <span className="text-amber-800 font-semibold">Drinks, water, and snacks are delivered strictly at printed MRP.</span>
        </div>
      </div>

      {/* Dynamic Station Selector Bar */}
      {!stationCode && (
        <div className="bg-white rounded-[28px] border border-slate-200/80 p-5 sm:p-6 shadow-sm mb-8 flex flex-col md:flex-row md:items-center justify-between gap-5 relative">
          <div className="absolute top-0 left-0 bottom-0 w-2 bg-gradient-to-b from-rose-600 to-rose-500 rounded-l-[28px]" />

          <div className="flex items-center gap-4">
            <div className="bg-rose-50 text-rose-600 p-3.5 rounded-2xl border border-rose-100 shrink-0 shadow-xs flex items-center justify-center">
              <MapPin className="w-6 h-6 text-rose-600 animate-bounce" style={{ animationDuration: '3s' }} />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block">DELIVERY LOCATION</span>
              <span className="text-base sm:text-lg font-black text-slate-800 tracking-tight block mt-0.5">
                {selectedStation ? `${selectedStation.name} (${selectedStation.code})` : 'Showing All Hubs (Browse Mode)'}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-[480px] shrink-0">
            <span className="text-sm text-slate-500 font-bold hidden sm:inline shrink-0 uppercase tracking-wider text-[11px]">Junction:</span>

            {/* Custom Searchable Dropdown Container */}
            <div className="relative w-full">
              <button
                type="button"
                onClick={() => setShowHubDropdown(!showHubDropdown)}
                className="w-full bg-slate-50/70 hover:bg-slate-100/60 border border-slate-200 text-slate-800 text-sm sm:text-base font-extrabold py-3.5 px-5 rounded-2xl focus:outline-none focus:border-rose-500/85 focus:ring-4 focus:ring-rose-500/5 transition-all cursor-pointer flex justify-between items-center gap-3 shadow-xs"
              >
                <span className="truncate text-slate-800 font-black">
                  {selectedStation ? `${selectedStation.name} (${selectedStation.code})` : 'Select Junction (Browse Mode)'}
                </span>
                <span className="text-slate-400 text-xs transition-transform duration-300 transform group-hover:translate-y-0.5">▼</span>
              </button>

              {/* Dropdown Menu Overlay */}
              {showHubDropdown && (
                <>
                  {/* Backdrop to close on clicking outside */}
                  <div className="fixed inset-0 z-40" onClick={() => { setShowHubDropdown(false); setHubSearchQuery(''); }} />

                  <div className="absolute right-0 top-full mt-3 w-full min-w-[320px] sm:min-w-[400px] bg-white border border-slate-200/90 rounded-[24px] shadow-2xl z-50 p-4 space-y-3 animate-fadeIn border-t-rose-500 border-t-2">
                    {/* Search Input inside Dropdown */}
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 flex items-center justify-center">
                        <Search className="w-4 h-4" />
                      </span>
                      <input
                        type="text"
                        value={hubSearchQuery}
                        onChange={(e) => setHubSearchQuery(e.target.value)}
                        placeholder="Search railway station or code..."
                        className="w-full pl-10 pr-9 py-3 border border-slate-200 rounded-xl text-sm sm:text-base font-bold text-slate-800 focus:outline-none focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 bg-slate-50/60 transition-all font-sans"
                        onClick={(e) => e.stopPropagation()}
                      />
                      {hubSearchQuery && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setHubSearchQuery(''); }}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm font-black"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Scrollable Hub List */}
                    <div className="max-h-[260px] overflow-y-auto pr-1 space-y-2 scrollbar-thin">
                      {/* Browse Option */}
                      <button
                        type="button"
                        onClick={() => {
                          const params = new URLSearchParams(window.location.search);
                          params.delete('station');
                          localStorage.removeItem("selected_station_code");
                          setShowHubDropdown(false);
                          setHubSearchQuery('');
                          router.push(`${window.location.pathname}?${params.toString()}`);
                        }}
                        className={`w-full text-left px-4 py-3 rounded-xl text-sm sm:text-base font-black transition-all ${!stationCode ? 'bg-rose-50 text-rose-700 border border-rose-100 shadow-xs' : 'text-slate-600 hover:bg-slate-50 border border-transparent'}`}
                      >
                        Show All Stations (Browse Mode)
                      </button>

                      {/* Filtered stations list */}
                      {(() => {
                        const filtered = (stations || []).filter(s =>
                          (s.name || '').toLowerCase().includes(hubSearchQuery.toLowerCase()) ||
                          (s.code || '').toLowerCase().includes(hubSearchQuery.toLowerCase()) ||
                          (s.state || '').toLowerCase().includes(hubSearchQuery.toLowerCase())
                        );

                        if (filtered.length === 0) {
                          return (
                            <div className="text-center py-6 text-slate-400 text-sm font-bold bg-slate-50 rounded-xl border border-dashed border-slate-200">
                              No active hubs found.
                            </div>
                          );
                        }

                        return filtered.map(s => (
                          <button
                            key={s.code}
                            type="button"
                            onClick={() => {
                              const params = new URLSearchParams(window.location.search);
                              params.set('station', s.code);
                              localStorage.setItem("selected_station_code", s.code);
                              setShowHubDropdown(false);
                              setHubSearchQuery('');
                              router.push(`${window.location.pathname}?${params.toString()}`);
                            }}
                            className={`w-full text-left px-4 py-3 rounded-xl transition-all border flex justify-between items-center group/item hover:scale-[1.01] ${stationCode === s.code ? 'bg-rose-50/60 text-rose-700 border-rose-100/70' : 'text-slate-700 hover:bg-rose-50/30 border-slate-100 hover:border-rose-100/50 bg-slate-50/40'}`}
                          >
                            <div className="min-w-0 mr-3">
                              <span className="block truncate text-base sm:text-lg font-black text-slate-800 group-hover/item:text-rose-600 transition-colors">{s.name}</span>
                              <span className="text-[11px] sm:text-xs text-slate-450 font-bold uppercase tracking-wider block font-mono mt-0.5">{s.code} · {s.state}</span>
                            </div>
                            <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-100/80 px-2 py-0.5 rounded-md font-extrabold shrink-0 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping inline-block" />
                              Active
                            </span>
                          </button>
                        ));
                      })()}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {isClosed && (() => {
        const reasonText = getClosedReason();
        const isSuspended = reasonText.startsWith("Kitchen Suspended");
        const isHours = reasonText.startsWith("Closed Hours");
        return (
          <div className="bg-rose-50 border border-rose-250 text-rose-950 px-6 py-4 rounded-3xl mb-6 flex items-start gap-3.5 shadow-sm">
            <div className="bg-rose-100 text-rose-700 p-2.5 rounded-2xl border border-rose-150 shrink-0">
              <Info className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <h4 className="font-black text-base uppercase tracking-wider text-rose-700">
                {isSuspended ? '🛑 Kitchen Suspended' : isHours ? '🕒 Operational Hours Closed' : '⏱ Delivery Cutoff Reached'}
              </h4>
              <p className="text-sm text-rose-800 font-semibold mt-0.5 leading-relaxed">
                {reasonText.substring(reasonText.indexOf(':') + 2)}
              </p>
            </div>
          </div>
        );
      })()}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-6">

        {/* Left Side: Categories & Menu list */}
        <div className={`${isCartVisible ? 'lg:col-span-8' : 'lg:col-span-12'} space-y-8`}>

          {activeCategory === null ? (
            /* Show Categories Grid */
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Browse Categories</h2>
                <p className="text-sm text-slate-500 font-semibold mt-1">Select a category to explore fresh train-cooked meals.</p>
              </div>

              <div className="grid grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4">
                {stationCategories.map(cat => {
                  const rawCatObj = (categories || []).find(c => {
                    const matchExact = (c.name || '').toLowerCase() === cat.toLowerCase();
                    const matchLegacy = c.name && c.name.includes(':') && c.name.split(':')[1].toLowerCase() === cat.toLowerCase();
                    return matchExact || matchLegacy;
                  });
                  const categoryImage = rawCatObj?.image;
                  const itemCount = getCategoryCount(cat);

                  return (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      className="group bg-white border border-slate-200 rounded-2xl sm:rounded-[28px] p-2.5 sm:p-4 flex flex-col items-center text-center justify-between gap-2 sm:gap-3 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-rose-300"
                    >
                      <div className="w-full aspect-square rounded-xl sm:rounded-2xl bg-slate-50 overflow-hidden border border-slate-100 relative">
                        {categoryImage ? (
                          <img src={categoryImage} alt={cat} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-rose-50/30 text-rose-500">
                            <Utensils className="w-5 h-5 sm:w-8 sm:h-8 opacity-40" />
                          </div>
                        )}
                      </div>

                      <div className="space-y-0.5">
                        <span className="font-black text-slate-800 text-[13px] sm:text-[15px] md:text-base block group-hover:text-rose-600 transition-colors uppercase tracking-tight">{cat}</span>
                        <span className="text-xs sm:text-sm text-slate-400 font-bold block">{itemCount} Dishes</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Show Selected Category Products */
            <div className="space-y-3 md:space-y-6">
              {/* Back Button and Header */}
              <div className="sticky-category-header flex flex-row items-center justify-between gap-3 w-full overflow-hidden">
                <button
                  onClick={() => setActiveCategory(null)}
                  className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm font-black text-rose-600 bg-rose-50 border border-rose-100 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl sm:rounded-2xl hover:bg-rose-100 transition-all shadow-xs shrink-0"
                >
                  <ArrowLeft className="w-3.5 h-3.5 text-rose-600" /> Back to Categories
                </button>
                <div className="text-right min-w-0">
                  <span className="text-[8px] sm:text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block truncate">Selected Category</span>
                  <span className="text-sm sm:text-lg font-black text-slate-800 uppercase tracking-tight block truncate">{activeCategory}</span>
                </div>
              </div>

              {/* Filters & Search Block */}
              <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                  {/* Search input */}
                  <div className="relative flex-1 z-10">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={`Search in ${activeCategory}...`}
                      className="w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 transition-all placeholder-slate-400 font-bold bg-slate-50/50 focus:bg-white"
                    />
                  </div>

                  {/* Veg / Non-veg Quick Toggles */}
                  <div className="grid grid-cols-3 gap-1.5 w-full sm:flex sm:items-center sm:w-auto sm:gap-2 pb-1 sm:pb-0">
                    <button
                      onClick={() => setFoodTypeFilter(foodTypeFilter === 'veg' ? 'all' : 'veg')}
                      className={`px-2 py-1.5 sm:px-3 sm:py-2 rounded-xl text-[11px] xs:text-xs sm:text-sm font-black uppercase tracking-wider transition-all border flex items-center justify-center gap-1 sm:gap-1.5 shrink-0 ${foodTypeFilter === 'veg'
                        ? 'bg-emerald-600 border-emerald-655 text-white shadow-xs'
                        : 'bg-white border-slate-200 text-slate-650 hover:bg-slate-50'
                        }`}
                    >
                      <span className={`w-3 h-3 rounded-sm border flex items-center justify-center shrink-0 ${foodTypeFilter === 'veg' ? 'border-white' : 'border-emerald-600'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full block ${foodTypeFilter === 'veg' ? 'bg-white' : 'bg-emerald-600'}`} />
                      </span>
                      Veg Only
                    </button>

                    <button
                      onClick={() => setFoodTypeFilter(foodTypeFilter === 'nonveg' ? 'all' : 'nonveg')}
                      className={`px-2 py-1.5 sm:px-3 sm:py-2 rounded-xl text-[11px] xs:text-xs sm:text-sm font-black uppercase tracking-wider transition-all border flex items-center justify-center gap-1 sm:gap-1.5 shrink-0 ${foodTypeFilter === 'nonveg'
                        ? 'bg-amber-900 border-amber-955 text-white shadow-xs'
                        : 'bg-white border-slate-200 text-slate-650 hover:bg-slate-50'
                        }`}
                    >
                      <span className={`w-3 h-3 rounded-sm border flex items-center justify-center shrink-0 ${foodTypeFilter === 'nonveg' ? 'border-white' : 'border-amber-800'}`}>
                        <svg className={`w-1.5 h-1.5 ${foodTypeFilter === 'nonveg' ? 'fill-white' : 'fill-amber-900'}`} viewBox="0 0 100 100">
                          <polygon points="50,15 90,85 10,85" />
                        </svg>
                      </span>
                      Non-Veg
                    </button>

                    <button
                      onClick={() => setFoodTypeFilter(foodTypeFilter === 'standard' ? 'all' : 'standard')}
                      className={`px-2 py-1.5 sm:px-3 sm:py-2 rounded-xl text-[11px] xs:text-xs sm:text-sm font-black uppercase tracking-wider transition-all border flex items-center justify-center gap-1 sm:gap-1.5 shrink-0 ${foodTypeFilter === 'standard'
                        ? 'bg-slate-700 border-slate-750 text-white shadow-xs'
                        : 'bg-white border-slate-200 text-slate-650 hover:bg-slate-50'
                        }`}
                    >
                      <span className={`w-3 h-3 rounded-sm border flex items-center justify-center shrink-0 ${foodTypeFilter === 'standard' ? 'border-white' : 'border-slate-400'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full block ${foodTypeFilter === 'standard' ? 'bg-white' : 'bg-slate-400'}`} />
                      </span>
                      Standard
                    </button>
                  </div>
                </div>
              </div>

              {/* Menu Items Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                {filteredMenu.map(item => {
                  const hasVariants = item.variants && item.variants.length > 0;
                  const cartItemsForThisProduct = cart.filter(c => c.id === item.id || (c.id && c.id.toString().startsWith(`${item.id}_`)));
                  const totalQuantity = cartItemsForThisProduct.reduce((sum, c) => sum + c.quantity, 0);
                  const cartItem = totalQuantity > 0 ? { quantity: totalQuantity } : null;
                  const hasType = item.food_type !== '';
                  const isVeg = item.food_type
                    ? (item.food_type === 'veg')
                    : (!item.name.toLowerCase().includes('chicken') &&
                      !item.name.toLowerCase().includes('mutton') &&
                      !item.name.toLowerCase().includes('non veg') &&
                      !item.name.toLowerCase().includes('non-veg') &&
                      !item.name.toLowerCase().includes('meat') &&
                      !item.name.toLowerCase().includes('egg') &&
                      !item.name.toLowerCase().includes('fish'));

                  const stationsServingThisItem = getStationsForItem(item.name);

                  return (
                    <div key={item.id} className="bg-white rounded-2xl sm:rounded-3xl border border-slate-150 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-row sm:flex-col justify-between overflow-hidden relative group">
                      {/* Aspect Ratio square layout image top/left */}
                      <div className="relative w-24 h-24 sm:w-full sm:h-auto sm:aspect-square bg-slate-100 overflow-hidden shrink-0 rounded-xl sm:rounded-none m-3 sm:m-0 shadow-xs sm:shadow-none self-center sm:self-auto">
                        {item.image_url || item.image ? (
                          <img
                            src={item.image_url || item.image}
                            alt={item.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                          />
                        ) : (
                          <div className="text-slate-355 bg-gradient-to-br from-rose-500/5 to-amber-500/5 w-full h-full flex flex-col items-center justify-center gap-2">
                            <Utensils className="w-6 h-6 sm:w-8 sm:h-8 text-rose-200/80" />
                            <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-slate-400">{item.category}</span>
                          </div>
                        )}

                        {/* Floating Indicators for Desktop */}
                        <div className="absolute top-2 left-2 sm:top-3.5 sm:left-3.5 hidden sm:flex items-center gap-1.5 z-10">
                          <span className="text-[9px] bg-slate-900/80 text-white font-extrabold px-2.5 py-0.5 rounded-md uppercase tracking-wider backdrop-blur-sm">
                            {item.category}
                          </span>
                          {!stationCode && (
                            <span className="text-[9px] bg-rose-600/90 text-white font-extrabold px-2.5 py-0.5 rounded-md uppercase tracking-wider backdrop-blur-sm">
                              {stationsServingThisItem.length} Hubs
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="p-3 pl-1.5 sm:p-5 flex-1 flex flex-col justify-between gap-2 sm:gap-3 min-w-0">
                        <div className="space-y-1">
                          <h3 className="font-extrabold text-slate-800 text-base sm:text-lg lg:text-lg tracking-tight leading-snug group-hover:text-rose-600 transition-colors flex items-start gap-1.5">
                            {hasType && (
                              <span className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center shrink-0 mt-1 ${isVeg ? 'border-emerald-600' : 'border-amber-800'}`}>
                                {isVeg ? (
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 block" />
                                ) : (
                                  <svg className="w-1.5 h-1.5 fill-amber-800" viewBox="0 0 100 100">
                                    <polygon points="50,15 90,85 10,85" />
                                  </svg>
                                )}
                              </span>
                            )}
                            <span>{item.name}</span>
                          </h3>
                          {item.description && (
                            <p className="text-[13px] sm:text-[15px] lg:text-base text-slate-450 leading-relaxed">{item.description}</p>
                          )}
                          {!stationCode && (
                            <span className="inline-block text-[9px] bg-rose-50 text-rose-600 border border-rose-100 font-extrabold px-2 py-0.5 rounded-lg uppercase tracking-wider w-fit mt-1">
                              Available at {stationsServingThisItem.length} Stations
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between mt-1 sm:mt-2">
                          <div className="flex flex-col">
                            <span className="text-slate-800 font-extrabold text-lg sm:text-xl font-mono">₹{item.price}</span>
                            {item.mrp > item.price && (
                              <span className="text-xs sm:text-sm text-slate-400 line-through font-mono">MRP: ₹{item.mrp}</span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {isClosed ? (
                              <button
                                disabled
                                className="bg-slate-50 text-slate-400 text-xs font-black uppercase tracking-wider py-1.5 rounded-xl cursor-not-allowed border border-slate-200 w-20 sm:w-24 text-center shrink-0"
                              >
                                Closed
                              </button>
                            ) : item.available === false ? (
                              <button
                                disabled
                                className="bg-slate-100 text-red-500 border border-slate-200 text-[10px] font-black uppercase py-2.5 rounded-xl cursor-not-allowed w-20 sm:w-24 text-center shrink-0 leading-none"
                              >
                                Out of Stock
                              </button>
                            ) : cartItem ? (
                              <div className="flex items-center justify-between bg-rose-600 text-white rounded-xl py-1.5 px-2 sm:py-2 sm:px-3 shadow-md shadow-rose-600/10 animate-scaleIn w-20 sm:w-24 shrink-0">
                                <button
                                  onClick={() => {
                                    if (hasVariants) {
                                      const lastAdded = cartItemsForThisProduct[cartItemsForThisProduct.length - 1];
                                      if (lastAdded) removeFromCart(lastAdded.id);
                                    } else {
                                      removeFromCart(item.id);
                                    }
                                  }}
                                  className="p-0.5 hover:bg-rose-700/50 rounded transition-colors"
                                >
                                  <Minus className="w-3.5 h-3.5 sm:w-3.5 sm:h-3.5" />
                                </button>
                                <span className="text-sm font-black min-w-3 text-center">{cartItem.quantity}</span>
                                <button onClick={() => addToCart(item)} className="p-0.5 hover:bg-rose-700/50 rounded transition-colors">
                                  <Plus className="w-3.5 h-3.5 sm:w-3.5 sm:h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => addToCart(item)}
                                className="bg-rose-550/5 hover:bg-rose-600 hover:text-white text-rose-650 border border-rose-200/80 text-sm sm:text-base font-black uppercase tracking-wider py-2 rounded-xl transition-all duration-300 flex items-center justify-center gap-0.5 shadow-xs w-20 sm:w-24 shrink-0"
                              >
                                <Plus className="w-3.5 h-3.5 sm:w-3.5 sm:h-3.5 shrink-0" /> Add
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {filteredMenu.length === 0 && (
                  <div className="col-span-full py-16 px-4 text-center flex flex-col items-center justify-center space-y-4 w-full max-w-full md:max-w-xl lg:max-w-2xl mx-auto mt-6">
                    <div className="w-16 h-16 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-500 shadow-sm shadow-rose-500/5 animate-pulse">
                      <Utensils className="w-7 h-7 text-rose-500" />
                    </div>
                    <div className="space-y-1.5 w-full">
                      <h3 className="font-black text-slate-800 text-lg uppercase tracking-tight">No Dishes Available</h3>
                      <p className="text-sm text-slate-450 font-bold max-w-xs md:max-w-md lg:max-w-lg mx-auto leading-relaxed">
                        We couldn't find any dishes in this category matching your search. Try changing your filters or searching another keyword.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Perforated Invoice Cart */}
        {isCartVisible && (
          <div className="hidden lg:block lg:col-span-4 animate-fadeIn">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-lg overflow-visible sticky top-24">

              {/* Ticket upper header */}
              <div className="bg-slate-900 text-white rounded-t-3xl p-5 flex justify-between items-center border-b border-slate-800">
                <h2 className="font-black text-base flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-amber-405" /> PANTRY ORDER CART
                </h2>
                <span className="font-mono text-sm text-slate-400 font-bold">STATION: {stationCode || 'ALL'}</span>
              </div>

              {/* Perforated ticket notch */}
              <div className="flex items-center gap-0 -my-0.5 bg-white relative z-10">
                <div className="w-3 h-3 rounded-full bg-slate-50 border border-slate-200 shrink-0 -ml-1.5 shadow-inner" />
                <div className="flex-1 border-t border-dashed border-slate-200" />
                <div className="w-3 h-3 rounded-full bg-slate-50 border border-slate-200 shrink-0 -mr-1.5 shadow-inner" />
              </div>

              <div className="p-6 space-y-6">
                {/* Cart Items List */}
                {cart.length > 0 ? (
                  <div className="space-y-4 max-h-[260px] overflow-y-auto pr-1 scrollbar-thin">
                    {cart.map(item => {
                      const baseId = item.id.toString().split('_')[0];
                      const matchedItem = menuItems.find(mi => mi.id.toString() === baseId);
                      const displayImage = item.image_url || matchedItem?.image_url || matchedItem?.image;
                      return (
                        <div key={item.id} className="flex justify-between items-center text-xs p-2 bg-slate-50 rounded-xl border border-slate-100 gap-2.5">
                          <div className="w-10 h-10 rounded-lg bg-white overflow-hidden shrink-0 border border-slate-200 flex items-center justify-center">
                            {displayImage ? (
                              <img src={displayImage} alt={item.name} className="w-full h-full object-cover" />
                            ) : (
                              <Utensils className="w-4 h-4 text-rose-300" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0 pr-1">
                            <h4 className="font-bold text-slate-800 tracking-tight truncate text-sm">{item.name}</h4>
                            <span className="text-xs text-slate-450 font-medium">₹{item.price} &times; {item.quantity}</span>
                          </div>
                          <div className="flex items-center gap-2 bg-white border border-slate-250 rounded-lg px-1.5 py-0.5 shadow-sm">
                            <button onClick={() => removeFromCart(item.id)} className="p-0.5 hover:bg-slate-100 rounded text-slate-550 transition-colors">
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="font-black text-slate-700 min-w-3 text-center">{item.quantity}</span>
                            <button onClick={() => addToCart(item)} className="p-0.5 hover:bg-slate-100 rounded text-slate-550 transition-colors">
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-12 text-center text-slate-400 text-sm flex flex-col items-center gap-3">
                    <div className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center border border-slate-150">
                      <ShoppingBag className="w-6 h-6 text-slate-350" />
                    </div>
                    <p className="font-medium text-slate-500">Pantry cart is empty.<br />Add hot snacks to start ordering!</p>
                  </div>
                )}

                {/* Progress bar towards Free Gift */}
                {subtotal > 0 && subtotal < (giftThreshold || 300) && (
                  <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4 text-sm space-y-2">
                    <div className="flex justify-between font-bold text-slate-650">
                      <span className="flex items-center gap-1"><Gift className="w-3.5 h-3.5 text-rose-500" /> Free Gift Progress</span>
                      <span>₹{subtotal} / ₹{giftThreshold || 300}</span>
                    </div>
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-rose-500 to-amber-500 h-full transition-all duration-500"
                        style={{ width: `${Math.min((subtotal / (giftThreshold || 300)) * 100, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-450 font-semibold">Add ₹{(giftThreshold || 300) - subtotal} more to unlock a free <strong className="text-rose-600">{freeProduct}</strong>!</p>
                  </div>
                )}

                {/* Special Free Gift Alert */}
                {subtotal >= (giftThreshold || 300) && (
                  <div className="bg-gradient-to-br from-amber-500/10 via-rose-500/5 to-transparent border border-amber-200 rounded-2xl p-4 text-slate-800 text-sm flex gap-3 items-start animate-pulse">
                    <Gift className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-black text-amber-700 uppercase tracking-wider block">Eligible for Free Gift! 🎁</span>
                      <p className="text-slate-655 font-medium mt-0.5">Delivery partner will bring your free <strong className="text-rose-655">{freeProduct}</strong> free of charge.</p>
                    </div>
                  </div>
                )}

                {/* Price Calculations */}
                <div className="space-y-3 border-t border-slate-100 pt-4 text-sm font-bold text-slate-500">
                  <div className="flex justify-between">
                    <span>Pantry Subtotal</span>
                    <span className="text-slate-800">₹{subtotal}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Berth Delivery Fee</span>
                    <span className={`font-black ${activeDeliveryFee === 0 ? 'text-emerald-600 font-bold' : 'text-slate-800'}`}>
                      {activeDeliveryFee === 0 ? 'Free' : `₹${activeDeliveryFee}`}
                    </span>
                  </div>

                  <div className="flex justify-between text-base font-black text-slate-800 border-t border-slate-150 pt-3">
                    <span>Total Payable</span>
                    <span className="text-rose-600 text-lg">₹{total}</span>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <button
                    onClick={handleCheckoutProceed}
                    disabled={cart.length === 0 || isClosed}
                    className="w-full bg-rose-600 hover:bg-rose-500 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black uppercase tracking-wider py-3 rounded-2xl transition-all shadow-md text-sm flex items-center justify-center gap-1.5"
                  >
                    {isClosed ? 'Ordering Closed' : 'PROCEED TO SEAT DETAILS'}
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}
      </div>

      {/* Station Picker Modal for Consolidated browse items */}
      {stationPickerItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white border border-slate-250 p-6 sm:p-8 rounded-[32px] w-full max-w-md shadow-2xl space-y-4 animate-scaleIn relative overflow-hidden">

            {/* Absolute close button */}
            <button
              onClick={() => { setStationPickerItem(null); setStationSearchQuery(''); }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors z-20 shadow-xs"
            >
              <X className="w-4.5 h-4.5" />
            </button>

            {/* Sexy Centered Header */}
            <div className="flex flex-col items-center text-center pt-2">
              {/* Product Image */}
              {(stationPickerItem.image_url || stationPickerItem.image) ? (
                <img
                  src={stationPickerItem.image_url || stationPickerItem.image}
                  alt={stationPickerItem.name}
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl object-contain bg-slate-50 border border-slate-200/80 shadow-md p-2 transition-transform duration-500 hover:scale-105"
                />
              ) : (
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-rose-50 border border-rose-100 flex items-center justify-center shadow-inner">
                  <Utensils className="w-9 h-9 text-rose-500/80" />
                </div>
              )}

              <span className="text-[10px] text-rose-700 bg-rose-50 border border-rose-100 px-2.5 py-0.5 rounded font-black uppercase tracking-wider flex items-center gap-1 w-fit mt-4 shadow-xs">
                <MapPin className="w-3 h-3 text-rose-500" /> Select Delivery Junction
              </span>
              
              <h3 className="text-lg sm:text-xl font-black text-slate-800 tracking-tight mt-3 leading-snug">
                Where should we deliver <span className="text-rose-600 font-black">{stationPickerItem.name}</span>?
              </h3>
            </div>

            <p className="text-sm sm:text-base text-slate-500 leading-normal font-semibold">
              This item is freshly cooked and served at the following active junctions. Please select one to add to your order:
            </p>

            {/* Station Search Input Bar */}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 flex items-center justify-center">
                <Search className="w-4 h-4 text-slate-400" />
              </span>
              <input
                type="text"
                value={stationSearchQuery}
                onChange={(e) => setStationSearchQuery(e.target.value)}
                placeholder="Search station by name or code..."
                className="w-full pl-9 pr-8 py-2.5 border border-slate-200 rounded-xl text-sm sm:text-base font-bold text-slate-800 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500/10 bg-slate-50 transition-all font-sans"
              />
              {stationSearchQuery && (
                <button
                  onClick={() => setStationSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs sm:text-sm font-black"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-2 scrollbar-thin">
              {(() => {
                const stationsList = getStationsForItem(stationPickerItem.name);
                const filtered = stationsList.filter(opt =>
                  opt.stationName.toLowerCase().includes(stationSearchQuery.toLowerCase()) ||
                  opt.station_code.toLowerCase().includes(stationSearchQuery.toLowerCase()) ||
                  (opt.stationState || '').toLowerCase().includes(stationSearchQuery.toLowerCase())
                );

                if (filtered.length === 0) {
                  return (
                    <div className="text-center py-8 text-slate-400 text-sm sm:text-base font-bold bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      Sorry! This item is not available at this station.
                    </div>
                  );
                }

                return filtered.map((opt) => (
                  <button
                    key={opt.station_code}
                    disabled={!opt.inStock}
                    onClick={() => {
                      handleSelectStationForItem(opt.station_code, stationPickerItem);
                      setStationSearchQuery('');
                    }}
                    className={`w-full flex justify-between items-center p-4 rounded-2xl transition-all text-xs font-bold ${
                      opt.inStock
                        ? 'bg-slate-50/60 hover:bg-rose-50/20 border border-slate-200/80 hover:border-rose-200/60 text-slate-805 hover:text-rose-700 hover:scale-[1.015] hover:shadow-md shadow-xs cursor-pointer'
                        : 'bg-slate-100/50 border border-slate-200 text-slate-400 cursor-not-allowed opacity-70'
                    }`}
                  >
                    <div className="text-left">
                      <span className={`font-extrabold block text-base sm:text-lg ${opt.inStock ? 'text-slate-800' : 'text-slate-400'}`}>{opt.stationName}</span>
                      <span className="text-xs sm:text-sm text-slate-400 uppercase tracking-widest font-bold font-mono mt-0.5 block">{opt.station_code} · {opt.stationState}</span>
                    </div>
                    <div className="text-right shrink-0 flex flex-col items-end">
                      <span className={`font-mono font-black text-base sm:text-lg block ${opt.inStock ? 'text-rose-600' : 'text-slate-400'}`}>₹{opt.price}</span>
                      {opt.inStock ? (
                        <span className="text-[9px] text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded font-black mt-1.5 inline-block w-fit">In Stock</span>
                      ) : (
                        <span className="text-[9px] text-red-500 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded font-black mt-1.5 inline-block w-fit">Out of Stock</span>
                      )}
                    </div>
                  </button>
                ));
              })()}
            </div>

            <div className="border-t border-slate-100 pt-3 text-center">
              <button
                onClick={() => { setStationPickerItem(null); setStationSearchQuery(''); }}
                className="text-sm text-slate-450 hover:text-slate-655 font-black uppercase tracking-wider py-1"
              >
                Cancel
              </button>
            </div>

          </div>
        </div>
      )}

      {variantSelectModalItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white border border-slate-250 p-6 md:p-8 rounded-3xl w-full max-w-md shadow-2xl space-y-5 animate-scaleIn">

            <div className="flex justify-between items-start">
              <div>
                <span className="text-[9px] text-rose-700 bg-rose-50 border border-rose-100 px-2.5 py-0.5 rounded font-black uppercase tracking-wider">
                  Select Size
                </span>
                <h3 className="text-xl font-black text-slate-800 tracking-tight mt-1">{variantSelectModalItem.name}</h3>
              </div>
              <button
                onClick={() => setVariantSelectModalItem(null)}
                className="text-slate-400 hover:text-slate-600 p-1 bg-slate-550 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-sm text-slate-400 leading-normal font-semibold">
              {variantSelectModalItem.description || 'Tasty meal prepared with standard safety guidelines.'}
            </p>

            <div className="space-y-2.5 pt-1">
              {variantSelectModalItem.variants && variantSelectModalItem.variants.map((v, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    addToCart(variantSelectModalItem, v);
                    setVariantSelectModalItem(null);
                  }}
                  className="w-full flex justify-between items-center bg-slate-50 hover:bg-rose-50 border border-slate-200 hover:border-rose-100 p-4 rounded-2xl transition-all text-sm font-bold text-slate-800 hover:text-rose-700 hover:scale-[1.01] shadow-sm"
                >
                  <span className="flex items-center gap-2">
                    <Coffee className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{v.name}</span>
                  </span>
                  <span className="text-rose-600 font-black text-base">₹{v.price}</span>
                </button>
              ))}
            </div>

            <div className="border-t border-slate-100 pt-3 text-center">
              <button
                onClick={() => setVariantSelectModalItem(null)}
                className="text-xs text-slate-450 hover:text-slate-650 font-black uppercase tracking-wider"
              >
                Go Back
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Sticky Bottom Checkout Bar for Mobile (Premium Light Theme style) */}
      {cart.length > 0 && !isClosed && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md text-slate-800 z-40 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] border-t border-slate-150 animate-slideUp flex flex-col">

          {/* Free Gift Promo Strip */}
          <div className="bg-amber-500/10 border-b border-amber-500/5 px-5 py-1.5 text-sm font-bold text-amber-800 text-center flex items-center justify-center gap-1">
            <Gift className="w-3 h-3 text-amber-600 shrink-0" />
            {subtotal < (giftThreshold || 300) ? (
              <span>Add <strong className="font-black">₹{(giftThreshold || 300) - subtotal}</strong> more to unlock a free <strong className="text-rose-600 font-black">{freeProduct}</strong>!</span>
            ) : (
              <span className="text-emerald-700"><strong className="font-black text-emerald-800">FREE GIFT UNLOCKED!</strong> Delivery partner will bring your free <strong className="text-rose-600 font-black">{freeProduct}</strong>. 🎁</span>
            )}
          </div>

          <div className="p-4 px-5 pb-5 flex items-center justify-between">
            <div className="flex flex-col cursor-pointer group" onClick={() => setShowCartDrawer(true)}>
              <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider flex items-center gap-1">
                Total Payable <span className="text-[11px] text-rose-600 font-black shrink-0 bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded-md">View Details ▲</span>
              </span>
              <span className="text-rose-600 font-black text-lg font-mono">₹{total}</span>
            </div>
            <button
              onClick={handleCheckoutProceed}
              className="bg-rose-600 hover:bg-rose-500 text-white text-sm font-black uppercase tracking-wider py-2.5 px-5 rounded-xl transition-all shadow-md flex items-center gap-1.5"
            >
              <span>Proceed ({cart.reduce((sum, item) => sum + item.quantity, 0)})</span>
            </button>
          </div>
        </div>
      )}

      {/* 📱 Mobile Bottom Drawer (Basket Details sheet) */}
      {showCartDrawer && cart.length > 0 && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setShowCartDrawer(false)}
            className="fixed inset-0 bg-slate-950/60 z-50 backdrop-blur-xs transition-opacity duration-300 animate-fadeIn"
          />
          {/* Drawer content */}
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-[32px] shadow-[0_-12px_40px_rgba(0,0,0,0.15)] max-h-[80vh] overflow-y-auto flex flex-col animate-slideUp border-t border-slate-200 lg:hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2">
                <span className="bg-rose-550/5 text-rose-600 p-1.5 rounded-lg border border-rose-100/50">
                  <ShoppingBag className="w-4.5 h-4.5" />
                </span>
                <div>
                  <h3 className="font-black text-slate-800 text-base uppercase tracking-wider">Your Basket</h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">{cart.length} food items selected</p>
                </div>
              </div>
              <button
                onClick={() => setShowCartDrawer(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center font-black transition-all active:scale-90"
              >
                ✕
              </button>
            </div>

            {/* List items block */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1 scrollbar-hide pb-8">
              {cart.map((item, idx) => {
                const baseId = item.id.toString().split('_')[0];
                const matchedItem = (menuItems || []).find(mi => mi.id.toString() === baseId);
                const displayImage = item.image_url || item.image || matchedItem?.image_url || matchedItem?.image;
                return (
                  <div key={item.id} className="flex items-center gap-3.5 bg-slate-50 border border-slate-150 p-4 rounded-2xl">
                    <div className="w-16 h-16 rounded-xl overflow-hidden bg-white shrink-0 border border-slate-200 flex items-center justify-center">
                      {displayImage ? (
                        <img src={displayImage} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-slate-355 text-sm">🍴</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 flex items-center justify-between gap-2.5">
                      <div className="min-w-0">
                        <h4 className="text-sm sm:text-base font-black text-slate-800 leading-snug">{item.name}</h4>
                        <p className="text-xs sm:text-sm text-slate-400 font-bold mt-0.5 font-mono">₹{item.price} each</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden h-9 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              updateCartItemQuantity(item.id, item.quantity - 1);
                              if (cart.length <= 1 && item.quantity === 1) {
                                setShowCartDrawer(false);
                              }
                            }}
                            className="px-3.5 h-full text-slate-550 hover:bg-slate-50 text-sm font-black transition-colors"
                          >
                            -
                          </button>
                          <span className="px-1 text-xs sm:text-sm font-black text-slate-700 w-6 text-center">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateCartItemQuantity(item.id, item.quantity + 1)}
                            className="px-3.5 h-full text-slate-550 hover:bg-slate-50 text-sm font-black transition-colors"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function Menu() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-rose-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-400 font-extrabold text-xs uppercase tracking-widest animate-pulse">Loading Menu...</p>
      </div>
    }>
      <MenuContent />
    </Suspense>
  );
}
