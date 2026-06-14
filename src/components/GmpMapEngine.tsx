// @ts-nocheck
import React, { useEffect, useState, useRef } from 'react';
import { APIProvider, Map, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { Loader2, Search, MapPin, Navigation } from 'lucide-react';
import { showToast } from '../utils/toast';

const EGYPT_CITIES: Record<string, string[]> = {
  'القاهرة': ['مصر الجديدة', 'مدينة نصر', 'المعادي', 'التجمع الخامس', 'شبرا', 'المرج', 'حلوان', 'المطرية', 'الزيتون', 'السلام', 'البساتين', 'دار السلام', 'الخليفة', 'المقطم', 'القاهرة الجديدة', 'بدر', 'الشروق', '15 مايو', 'وسط البلد', 'عين شمس', 'الزمالك'],
  'الجيزة': ['الجيزة', 'الدقي', 'المهندسين', 'الهرم', 'العجوزة', 'إمبابة', 'الشيخ زايد', '6 أكتوبر', 'العمرانية', 'البدرشين', 'الصف', 'أطفيح', 'العياط', 'منشأة القناطر', 'أوسيم', 'كرداسة', 'أبو النمرس', 'الحوامدية'],
  'الإسكندرية': ['الإسكندرية', 'برج العرب', 'العامرية', 'المنتزه', 'الرمل', 'سيدي بشر', 'سموحة', 'ميامي', 'كليوباترا', 'البيطاش', 'الدخيلة', 'العجمي', 'المندرة', 'محرم بك', 'الجمرك', 'المنشية'],
  'الشرقية': ['الزقازيق', 'أبو حماد', 'بلبيس', 'العاشر من رمضان', 'منيا القمح', 'فاقوس', 'الحسينية', 'أبو كبير', 'ديرب نجم', 'مشتول السوق', 'الإبراهيمية', 'كفر صقر', 'أولاد صقر', 'الصالحية الجديدة', 'القرين', 'القنايات'],
  'الدقهلية': ['المنصورة', 'ميت غمر', 'السنبلاوين', 'دكرنس', 'أجا', 'بلقاس', 'شربين', 'طلخا', 'نبروه', 'جمصة', 'بني عبيد', 'المطرية', 'تمي الأمديد', 'محلة دمنة', 'الكردي'],
  'البحيرة': ['دمنهور', 'كفر الدوار', 'رشيد', 'إدكو', 'أبو المطامير', 'أبو حمص', 'الدلنجات', 'المحمودية', 'الرحمانية', 'إيتاي البارود', 'شبراخيت', 'كوم حمادة', 'وادي النطرون', 'بدر'],
  'القليوبية': ['بنها', 'شبرا الخيمة', 'قليوب', 'الخانكة', 'العبور', 'القناطر الخيرية', 'طوخ', 'قها', 'كفر شكر', 'شبين القناطر', 'الخصوص'],
  'الغربية': ['طنطا', 'المحلة الكبرى', 'زفتى', 'كفر الزيات', 'سمنود', 'السنطة', 'بسيون', 'قطور'],
  'المنوفية': ['شبين الكوم', 'منوف', 'مدينة السادات', 'سرس الليان', 'أشمون', 'الباجور', 'قويسنا', 'بركة السبع', 'تلا', 'الشهداء'],
  'دمياط': ['دمياط', 'دمياط الجديدة', 'رأس البر', 'فارسكور', 'الزرقا', 'كفر سعد', 'كفر البطيخ', 'عزبة البرج', 'ميت أبو غالب', 'السرو'],
  'بورسعيد': ['بورسعيد', 'بورفؤاد', 'الشرق', 'الزهور', 'الضواحي', 'المناخ', 'الجنوب'],
  'الإسماعيلية': ['الإسماعيلية', 'فايد', 'القنطرة شرق', 'القنطرة غرب', 'التل الكبير', 'أبو صوير', 'القصاصين'],
  'السويس': ['السويس', 'الأربعين', 'عتاقة', 'الجناين', 'فيصل'],
  'كفر الشيخ': ['كفر الشيخ', 'دسوق', 'فوه', 'مطوبس', 'بلطيم', 'الحامول', 'بيلا', 'الرياض', 'سيدي سالم', 'قلين', 'برج البرلس', 'مسير', 'سيدي غازي'],
  'الفيوم': ['الفيوم', 'سنورس', 'إطسا', 'طامية', 'إبشواي', 'يوسف الصديق'],
  'بني سويف': ['بني سويف', 'الواسطى', 'ناصر', 'إهناسيا', 'ببا', 'سمسطا', 'الفشن'],
  'المنيا': ['المنيا', 'مغاغة', 'بني مزار', 'مطاي', 'سمالوط', 'أبو قرقاص', 'ملوي', 'دير مواس', 'العدوة'],
  'أسيوط': ['أسيوط', 'ديروط', 'القوصية', 'أبنوب', 'منفلوط', 'أبو تيج', 'الغنايم', 'ساحل سليم', 'البداري', 'الفتح', 'أسيوط الجديدة'],
  'سوهاج': ['سوهاج', 'أخميم', 'البلينا', 'المراغة', 'المنشأة', 'دار السلام', 'جرجا', 'جهينة', 'ساقلتة', 'طما', 'طهطا', 'سوهاج الجديدة'],
  'قنا': ['قنا', 'أبو تشت', 'فرشوط', 'نجع حمادي', 'الوقف', 'دشنا', 'قفط', 'قوص', 'نقادة'],
  'الأقصر': ['الأقصر', 'إسنا', 'أرمنت', 'الطود', 'البياضية', 'القرنة', 'الزينية'],
  'أسوان': ['أسوان', 'كوم أمبو', 'دراو', 'إدفو', 'نصر النوبة', 'أبو سمبل', 'كلابشة', 'الرديسية', 'البصيلية'],
  'مطروح': ['مرسى مطروح', 'العلمين', 'الضبعة', 'براني', 'السلوم', 'سيدي بئراني', 'سيدي عبد الرحمن', 'النجيلة', 'سيوة'],
  'البحر الأحمر': ['الغردقة', 'رأس غارب', 'سفاجا', 'القصير', 'مرسى علم', 'شلاتين', 'حلايب'],
  'الوادي الجديد': ['الخارجة', 'الداخلة', 'الفرافرة', 'باريس', 'بلاط'],
  'شمال سيناء': ['العريش', 'بئر العبد', 'الشيخ زويد', 'رفح', 'الحسنة', 'نخل'],
  'جنوب سيناء': ['الطور', 'شرم الشيخ', 'دهب', 'نويبع', 'طابا', 'سانت كاترين', 'أبو رديس', 'أبو زنيمة', 'رأس سدر']
};

class MapErrorBoundary extends React.Component<{children: React.ReactNode}, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true };
  }
  componentDidCatch(error: any, errorInfo: any) {
    console.error("Map Error caught:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return <div className="flex items-center justify-center h-full w-full bg-[#E0E2E7] text-slate-400">📍 الخريطة قيد التحميل البديل...</div>;
    }
    return this.props.children;
  }
}

interface GmpMapEngineProps {
  storeType: string | string[];
  batchSize: number;
  onResults: (results: any[]) => void;
  isSearching: boolean;
  setIsSearching: (b: boolean) => void;
  apiKey?: string;
}

// مكون مساعد لرسم دائرة نطاق البحث على خريطة جوجل
function MapCircle({ center, radius }: { center: any, radius: number }) {
  const map = useMap();
  const circleRef = useRef<any>(null);

  useEffect(() => {
    if (!map || !window.google || !window.google.maps || !window.google.maps.Circle) return;

    circleRef.current = new window.google.maps.Circle({
      strokeColor: '#DD6B20',
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillColor: '#DD6B20',
      fillOpacity: 0.15,
      map,
      center,
      radius,
    });

    return () => {
      if (circleRef.current) {
        circleRef.current.setMap(null);
        circleRef.current = null;
      }
    };
  }, [map]);

  useEffect(() => {
    if (circleRef.current) {
      circleRef.current.setOptions({ center, radius });
    }
  }, [center, radius]);

  return null;
}

// مكون لربط وحفظ مرجع الخريطة وتمريره للمكون الأب لتفادي مشكلة استخدام useMap خارج السياق
function MapRefTracker({ setMap }: { setMap: (map: any) => void }) {
  const map = useMap();
  useEffect(() => {
    if (map) {
      setMap(map);
    }
  }, [map, setMap]);
  return null;
}

function MapSearchInner({ storeType, batchSize, onResults, isSearching, setIsSearching, apiKey }: GmpMapEngineProps) {
  const [mapInstance, setMapInstance] = useState<any>(null);
  const placesLib = useMapsLibrary('places');
  const geocodingLib = useMapsLibrary('geocoding');
  const geometryLib = useMapsLibrary('geometry');

  const [center, setCenter] = useState({ lat: 30.0444, lng: 31.2357 }); // Cairo
  const [mapRadius, setMapRadius] = useState(1500);
  const [searchAreaText, setSearchAreaText] = useState('');
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isGpsLoading, setIsGpsLoading] = useState(false);
  
  const [selectedGov, setSelectedGov] = useState('');
  const [selectedCity, setSelectedCity] = useState('');

  // تحديد ما إذا كنا سنستخدم بديل OpenStreetMap (تلقائي في حال عدم وجود مفتاح أو تعطل جوجل)
  const [useOsmFallback, setUseOsmFallback] = useState(false);

  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const leafletContainerRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);
  const leafletCircleRef = useRef<any>(null);


  // تحميل Leaflet ديناميكياً عند تفعيل OSM Fallback
  useEffect(() => {
    if (!useOsmFallback) return;

    if (window.L) {
      setLeafletLoaded(true);
      return;
    }

    // إضافة Leaflet CSS
    const cssId = 'leaflet-css-fallback';
    if (!document.getElementById(cssId)) {
      const link = document.createElement('link');
      link.id = cssId;
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    // إضافة Leaflet JS
    const jsId = 'leaflet-js-fallback';
    if (!document.getElementById(jsId)) {
      const script = document.createElement('script');
      script.id = jsId;
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => setLeafletLoaded(true);
      document.head.appendChild(script);
    } else {
      const checkInterval = setInterval(() => {
        if (window.L) {
          setLeafletLoaded(true);
          clearInterval(checkInterval);
        }
      }, 100);
      return () => clearInterval(checkInterval);
    }
  }, [useOsmFallback]);

  // تهيئة خريطة Leaflet
  useEffect(() => {
    if (!useOsmFallback || !leafletLoaded || !leafletContainerRef.current) return;

    if (leafletMapRef.current) {
      try {
        leafletMapRef.current.remove();
      } catch (e) {}
      leafletMapRef.current = null;
    }

    const L = window.L;
    const mapInstance = L.map(leafletContainerRef.current, {
      zoomControl: true,
      scrollWheelZoom: true,
      attributionControl: false
    }).setView([center.lat, center.lng], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapInstance);

    const circleInstance = L.circle([center.lat, center.lng], {
      color: '#DD6B20',
      fillColor: '#DD6B20',
      fillOpacity: 0.15,
      radius: mapRadius
    }).addTo(mapInstance);

    leafletMapRef.current = mapInstance;
    leafletCircleRef.current = circleInstance;

    mapInstance.on('move', () => {
      const c = mapInstance.getCenter();
      circleInstance.setLatLng(c);
    });

    mapInstance.on('moveend', () => {
      const c = mapInstance.getCenter();
      setCenter({ lat: c.lat, lng: c.lng });
      reverseGeocodeOsm(c.lat, c.lng);
    });

    return () => {
      if (leafletMapRef.current) {
        try {
          leafletMapRef.current.remove();
        } catch (e) {}
        leafletMapRef.current = null;
        leafletCircleRef.current = null;
      }
    };
  }, [useOsmFallback, leafletLoaded]);

  // تحديث حجم دائرة OSM عند تغيير المدى
  useEffect(() => {
    if (leafletCircleRef.current) {
      leafletCircleRef.current.setRadius(mapRadius);
    }
  }, [mapRadius]);

  // البحث الجغرافي العكسي لـ OSM (Nominatim)
  const reverseGeocodeOsm = async (lat: number, lng: number) => {
    setIsReverseGeocoding(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
        headers: { 'User-Agent': 'SalesApp/1.0' }
      });
      if (response.ok) {
        const data = await response.json();
        const addr = data.address || {};
        const bestName = addr.suburb || addr.quarter || addr.neighbourhood || addr.city || addr.town || addr.village || data.display_name;
        setSearchAreaText(bestName || '');
      }
    } catch (e) {
      console.error("OSM Reverse Geocoding Error:", e);
    } finally {
      setIsReverseGeocoding(false);
    }
  };

  // البحث بالاسم لـ OSM (Nominatim)
  const geocodeOsm = async (text: string) => {
    if (!text.trim()) return;
    setIsLocating(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(text + ' مصر')}&limit=1`, {
        headers: { 'User-Agent': 'SalesApp/1.0' }
      });
      if (response.ok) {
        const data = await response.json();
        if (data && data.length > 0) {
          const newCenter = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
          setCenter(newCenter);
          if (leafletMapRef.current) {
            leafletMapRef.current.setView([newCenter.lat, newCenter.lng], 13);
          }
        }
      }
    } catch (e) {
      console.error("OSM Geocoding Error:", e);
    } finally {
      setIsLocating(false);
    }
  };

  // البحث عن المحلات في OSM (Overpass API)
  const handleOsmSearch = async () => {
    setIsSearching(true);
    try {
      const finalArea = searchAreaText.trim() || 'القاهرة';
      const selectedTypesArray = Array.isArray(storeType) ? storeType : [storeType];
      
      let typesQuery = '';
      const buildOsmTypes = (t: string) => {
        if (t === 'سوبر ماركت') return 'supermarket|convenience';
        if (t === 'هايبر ماركت') return 'supermarket';
        if (t === 'ميني ماركت') return 'convenience|kiosk';
        if (t === 'حلواني ومخبز') return 'bakery|pastry|confectionery';
        if (t === 'مطاعم') return 'restaurant|fast_food|cafe';
        if (t === 'عطارة') return 'spices|herbalist';
        if (t === 'تجارة جملة') return 'wholesale';
        if (t === 'بقالة تموينية') return 'grocery|convenience';
        return 'shop|retail';
      };
      
      const matchedTypes = selectedTypesArray.includes('الكل') || selectedTypesArray.length === 0
        ? 'supermarket|convenience|kiosk|bakery|restaurant|fast_food|cafe|spices|wholesale|grocery'
        : selectedTypesArray.map(buildOsmTypes).join('|');
        
      const overpassQuery = `
        [out:json][timeout:25];
        (
          node["shop"~"${matchedTypes}"](around:${mapRadius},${center.lat},${center.lng});
          way["shop"~"${matchedTypes}"](around:${mapRadius},${center.lat},${center.lng});
          node["amenity"~"${matchedTypes}"](around:${mapRadius},${center.lat},${center.lng});
          way["amenity"~"${matchedTypes}"](around:${mapRadius},${center.lat},${center.lng});
        );
        out center;
      `;
      
      const osmResponse = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(overpassQuery)
      });
      
      if (!osmResponse.ok) throw new Error('تعذر جلب البيانات من خادم الخرائط المفتوحة.');
      
      const data = await osmResponse.json();
      if (data && data.elements) {
        let mapped = data.elements.map((el: any, idx: number) => {
          const tags = el.tags || {};
          const name = tags.name || tags.brand || tags.shop || tags.amenity || 'محل تجاري';
          const phone = tags.phone || tags['contact:phone'] || 'غير مسجل';
          const street = tags['addr:street'] || tags['addr:full'] || finalArea;
          const lat = el.lat || el.center?.lat || center.lat;
          const lon = el.lon || el.center?.lon || center.lng;
          
          let shopType = 'نشاط تجاري';
          if (tags.shop === 'supermarket') shopType = 'سوبر ماركت';
          else if (tags.shop === 'convenience' || tags.shop === 'kiosk') shopType = 'ميني ماركت';
          else if (tags.shop === 'bakery') shopType = 'حلواني ومخبز';
          else if (tags.amenity === 'restaurant' || tags.amenity === 'fast_food') shopType = 'مطاعم';
          
          return {
            id: `osm-lead-${el.id || Date.now()}-${idx}`,
            name: name,
            phone: phone,
            area: finalArea,
            detailedAddress: street,
            rating: null,
            reviewsCount: null,
            locationLink: `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`,
            type: shopType
          };
        });
        onResults(mapped);
      } else {
        onResults([]);
      }
    } catch (err: any) {
      console.error('OSM Search Error:', err);
      showToast('⚠️ خطأ في البحث البديل: ' + err.message);
      onResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // دالة البحث الكلاسيكي في خرائط جوجل في حال عدم تفعيل Places API (New)
  const searchClassicPlaces = (queryText: string): Promise<any[]> => {
    return new Promise((resolve) => {
      try {
        if (!window.google || !window.google.maps || !window.google.maps.places) {
          resolve([]);
          return;
        }
        const dummyDiv = document.createElement('div');
        const service = new window.google.maps.places.PlacesService(dummyDiv);
        
        service.textSearch({
          query: queryText,
          location: mapInstance ? mapInstance.getCenter() : new window.google.maps.LatLng(center.lat, center.lng),
          radius: mapRadius
        }, (results, status) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
            resolve(results);
          } else {
            resolve([]);
          }
        });
      } catch (e) {
        console.error("Classic search failed:", e);
        resolve([]);
      }
    });
  };

  // البحث الرئيسي
  const handleStartSearch = async () => {
    if (useOsmFallback) {
      await handleOsmSearch();
      return;
    }

    if (!placesLib || !mapInstance) {
      showToast('⚠️ الخريطة أو مكتبة الأماكن لم تكتمل التحميل بعد. يرجى المحاولة بعد قليل.');
      return;
    }
    
    setIsSearching(true);
    
    try {
      const finalArea = searchAreaText.trim() || 'القاهرة';
      const selectedTypesArray = Array.isArray(storeType) ? storeType : [storeType];

      let queriesToRun: { typeLabel: string; query: string }[] = [];
      
      const buildQueries = (t: string) => {
        if (t === 'سوبر ماركت') return { typeLabel: t, query: 'سوبر ماركت بقالة' };
        if (t === 'هايبر ماركت') return { typeLabel: t, query: 'هايبر ماركت أسواق' };
        if (t === 'ميني ماركت') return { typeLabel: t, query: 'ميني ماركت كشك' };
        if (t === 'حلواني ومخبز') return { typeLabel: t, query: 'حلواني مخبز افرنجي مخبز سياحي فينو حلويات شرقية' };
        if (t === 'مطاعم') return { typeLabel: t, query: 'مطعم فول وطعمية كشري اسماك بروستد مشويات' };
        if (t === 'بقالة تموينية') return { typeLabel: t, query: 'بدال تمويني جمعيتي مجمع استهلاكي' };
        if (t === 'عطارة') return { typeLabel: t, query: 'عطارة علافة سرجة توابل محمصة' };
        if (t === 'تجارة جملة') return { typeLabel: t, query: 'مخازن مواد غذائية تجارة جملة زيوت' };
        if (t === 'نصف جملة') return { typeLabel: t, query: 'محلات نصف جملة وقطاعي' };
        if (t === 'توزيع أغذية') return { typeLabel: t, query: 'شركات توزيع مواد غذائية' };
        if (t === 'مطابخ وتجهيزات') return { typeLabel: t, query: 'مطابخ مركزية تجهيزات ولائم متعهد طعام' };
        return { typeLabel: 'نشاط تجاري', query: 'محلات تجارية' };
      };

      if (selectedTypesArray.includes('الكل') || selectedTypesArray.length === 0) {
        queriesToRun = [
          { typeLabel: 'سوبر ماركت', query: 'سوبر ماركت بقالة' },
          { typeLabel: 'هايبر ماركت', query: 'هايبر ماركت أسواق كبيرة' },
          { typeLabel: 'ميني ماركت', query: 'ميني ماركت كشك' },
          { typeLabel: 'عطارة', query: 'عطارة علافة سرجة توابل محمصة' },
          { typeLabel: 'حلواني ومخبز', query: 'حلواني مخبز افرنجي مخبز سياحي فينو حلويات شرقية' },
          { typeLabel: 'بقالة تموينية', query: 'بدال تمويني جمعيتي مجمع استهلاكي' },
          { typeLabel: 'مطاعم', query: 'مطعم فول وطعمية كشري اسماك بروستد مشويات' },
          { typeLabel: 'تجارة جملة', query: 'مخازن مواد غذائية تجارة جملة زيوت' },
          { typeLabel: 'نصف جملة', query: 'محلات نصف جملة وقطاعي مواد غذائية' },
          { typeLabel: 'توزيع أغذية', query: 'شركات توزيع مواد غذائية' },
          { typeLabel: 'مطابخ وتجهيزات', query: 'مطابخ مركزية تجهيزات ولائم متعهد طعام' }
        ];
      } else {
        queriesToRun = selectedTypesArray.map(t => buildQueries(t));
      }

      const perQueryCount = Math.min(20, batchSize);
      const allPlaces: Record<string, any> = {};

      const getDistanceInMeters = (lat1: number, lng1: number, lat2: number, lng2: number) => {
        const R = 6371e3; // نصف قطر الأرض بالمتر
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = 
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
          Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
      };

      for (const qObj of queriesToRun) {
        try {
          let places: any[] = [];
          
          // محاولة جلب البيانات باستخدام Places API (New) الحديثة مع تحديد نطاق جغرافي مفضل
          try {
            const response = await placesLib.Place.searchByText({
              textQuery: `${qObj.query} في ${finalArea}`,
              fields: ['id', 'displayName', 'formattedAddress', 'location', 'internationalPhoneNumber', 'rating', 'userRatingCount', 'types'],
              maxResultCount: perQueryCount,
              locationBias: {
                circle: {
                  center: { lat: center.lat, lng: center.lng },
                  radius: mapRadius
                }
              }
            });
            places = response?.places || [];
          } catch (modernError) {
            console.warn("Modern Places API (New) failed or not active, falling back to classic PlacesService:", modernError);
            // بديل ذكي: استخدام PlacesService الكلاسيكي المتوافق مع كافة المفاتيح
            const classicResults = await searchClassicPlaces(`${qObj.query} في ${finalArea}`);
            places = classicResults.map(p => ({
              id: p.place_id,
              displayName: p.name,
              formattedAddress: p.formatted_address,
              location: p.geometry?.location,
              internationalPhoneNumber: p.formatted_phone_number || 'غير مسجل',
              rating: p.rating,
              userRatingCount: p.user_ratings_total,
              types: p.types
            }));
          }
          
          if (places && places.length > 0) {
            places.forEach(p => {
              const pId = p.id || p.place_id;
              if (pId && !allPlaces[pId]) {
                const lat = typeof p.location?.lat === 'function' ? p.location.lat() : p.location?.lat;
                const lng = typeof p.location?.lng === 'function' ? p.location.lng() : p.location?.lng;
                
                allPlaces[pId] = {
                  place: {
                    id: pId,
                    displayName: p.displayName || p.name || 'محل تجاري',
                    formattedAddress: p.formattedAddress || p.formatted_address || finalArea,
                    location: p.location,
                    internationalPhoneNumber: p.internationalPhoneNumber || 'غير مسجل',
                    rating: p.rating,
                    userRatingCount: p.userRatingCount || p.user_ratings_total,
                    lat: lat,
                    lng: lng
                  },
                  typeLabel: qObj.typeLabel
                };
              }
            });
          }
        } catch (e) {
           console.warn(`Query failed for: ${qObj.query}`, e);
        }
      }

      if (Object.keys(allPlaces).length > 0) {
        let mapped = Object.values(allPlaces).map((data: any, idx) => {
          const p = data.place;
          let phone = p.internationalPhoneNumber || 'غير مسجل';
          let detailedAddress = p.formattedAddress || finalArea;
          let rating = p.rating ? parseFloat(p.rating.toFixed(1)) : null;
          let reviewsCount = p.userRatingCount || null;
          
          return {
            id: `gmp-lead-${p.id || Date.now()}-${idx}`,
            name: p.displayName || 'محل تجاري',
            phone,
            area: finalArea,
            detailedAddress,
            rating,
            reviewsCount,
            locationLink: `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`,
            type: data.typeLabel,
            lat: p.lat,
            lng: p.lng
          };
        });
        
        // تصفية وحذف أي نتائج تقع خارج نطاق دائرة البحث الجغرافية المحددة بالكامل (مع سماح هامش 15% إضافي للأطراف)
        const maxAllowedDistance = mapRadius * 1.15;
        mapped = mapped.filter(item => {
          if (item.lat && item.lng) {
            const dist = getDistanceInMeters(center.lat, center.lng, item.lat, item.lng);
            return dist <= maxAllowedDistance;
          }
          return true;
        });

        onResults(mapped);
      } else {
        onResults([]);
      }
    } catch (err: any) {
      console.error('Google Maps API Error:', err);
      let errorMessage = 'حدث خطأ غير متوقع أثناء الاتصال بخوادم خرائط جوجل.';
      
      if (err.name === 'MapsRequestError' || err.message?.includes('ApiNotActivatedMapError')) {
          errorMessage = 'يرجى تفعيل (Places API) و (Geocoding API) و (Maps JavaScript API) من لوحة تحكم جوجل كلاود الخاص بك.';
      } else if (err.message?.includes('BillingNotEnabledMapError')) {
          errorMessage = 'يرجى تفعيل معلومات الدفع (Billing) في حساب جوجل كلاود الخاص بك لتعمل الخدمة.';
      } else if (err.message) {
          errorMessage = err.message;
      }
      
      showToast('⚠️ خطأ في خرائط جوجل: ' + errorMessage);
      onResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const geocodeAndGo = async (text: string) => {
    if (useOsmFallback) {
      await geocodeOsm(text);
      return;
    }

    if (!text.trim() || !geocodingLib || !mapInstance) return;
    setIsLocating(true);
    try {
      const geocoder = new geocodingLib.Geocoder();
      const res = await geocoder.geocode({ address: text + ' مصر' });
      if (res.results && res.results.length > 0) {
        const loc = res.results[0].geometry.location;
        const newCenter = { lat: loc.lat(), lng: loc.lng() };
        setCenter(newCenter);
        mapInstance.panTo(newCenter);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLocating(false);
    }
  };

  const reverseGeocode = async (lat: number, lng: number) => {
    if (!geocodingLib) return;
    setIsReverseGeocoding(true);
    try {
      const geocoder = new geocodingLib.Geocoder();
      const res = await geocoder.geocode({ location: { lat, lng } });
      if (res.results && res.results.length > 0) {
        let bestName = res.results[0].address_components.find(c => c.types.includes('sublocality'))?.long_name || 
                       res.results[0].address_components.find(c => c.types.includes('locality'))?.long_name || 
                       res.results[0].formatted_address;
        setSearchAreaText(bestName || '');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsReverseGeocoding(false);
    }
  };

  const handleGetMyLocation = () => {
    if (!navigator.geolocation) {
      showToast('⚠️ متصفحك لا يدعم تحديد الموقع.');
      return;
    }
    setIsGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const newCenter = { lat: latitude, lng: longitude };
        setCenter(newCenter);
        if (useOsmFallback) {
          if (leafletMapRef.current) leafletMapRef.current.setView([latitude, longitude], 13);
          reverseGeocodeOsm(latitude, longitude);
        } else {
          if (mapInstance) mapInstance.panTo(newCenter);
          reverseGeocode(latitude, longitude);
        }
        setIsGpsLoading(false);
      },
      (error) => {
        console.error(error);
        showToast('⚠️ فشل في جلب موقعك الحالي. تأكد من إعطاء صلاحية الـ GPS.');
        setIsGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <>
      <div className="flex flex-col gap-2 mt-4 relative z-10">
        {/* أداة الاختيار للمحافظة والمدينة */}
        <div className="bg-indigo-50/50 border border-indigo-100 p-3 rounded-xl mb-2 flex flex-col gap-2.5">
          <span className="text-[10.5px] font-black text-[#1A365D] flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5 text-[#DD6B20]" />
            البحث السريع بالمراكز والمدن التابعة للمحافظة:
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <select
                value={selectedGov}
                onChange={(e) => {
                  setSelectedGov(e.target.value);
                  setSelectedCity('');
                }}
                className="w-full bg-[#FFFFFF] border border-slate-200 rounded-lg p-2 text-xs font-bold text-[#1A365D] focus:ring-1 focus:ring-indigo-500 outline-none text-right"
              >
                <option value="">-- اختر المحافظة --</option>
                {Object.keys(EGYPT_CITIES).map(gov => (
                  <option key={gov} value={gov}>{gov}</option>
                ))}
              </select>
            </div>
            <div>
              <select
                value={selectedCity}
                onChange={(e) => {
                  const city = e.target.value;
                  setSelectedCity(city);
                  if (city && selectedGov) {
                    const targetLoc = `${city}، ${selectedGov}`;
                    setSearchAreaText(targetLoc);
                    geocodeAndGo(targetLoc);
                  }
                }}
                disabled={!selectedGov}
                className="w-full bg-[#FFFFFF] border border-slate-200 rounded-lg p-2 text-xs font-bold text-[#1A365D] focus:ring-1 focus:ring-indigo-500 outline-none disabled:opacity-50 text-right"
              >
                <option value="">-- اختر المركز أو المدينة --</option>
                {selectedGov && EGYPT_CITIES[selectedGov]?.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <label className="text-xs font-black text-[#1A365D]">أو البحث بكتابة اسم المنطقة يدوياً:</label>
        <div className="flex items-center gap-2">
            <input
            type="text"
            required
            placeholder="اكتب اسم المدينة أو المنطقة المجرى استكشافها هنا (مثال: الزقازيق، ميت غمر، بدر)..."
            value={searchAreaText}
            onChange={(e) => setSearchAreaText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') geocodeAndGo(searchAreaText);
            }}
            className="flex-1 bg-[#F7FAFC] border border-slate-200 rounded-lg p-2.5 text-xs font-bold focus:ring-2 focus:ring-indigo-500 text-right text-[#1A365D]"
            />
            <button
              type="button"
              onClick={handleGetMyLocation}
              disabled={isGpsLoading}
              title="تحديد موقعي الحالي بالـ GPS"
              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-3 py-2.5 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center shrink-0 cursor-pointer"
            >
              {isGpsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => geocodeAndGo(searchAreaText)}
              disabled={isLocating}
              className="bg-[#2B6CB0] hover:bg-[#2C5282] text-white px-4 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center transition-colors disabled:opacity-50 cursor-pointer shrink-0"
            >
              {isLocating ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : <Search className="h-4 w-4 shrink-0" />}
            </button>
        </div>
        
        {/* الخريطة التفاعلية */}
        <div className="mt-3.5 border border-slate-200 rounded-xl overflow-hidden bg-slate-50 relative shadow-inner">
          <div className="bg-slate-100 px-3 py-2 border-b border-slate-200 flex justify-between items-center text-[11px] font-bold text-slate-700">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse inline-block"></span>
              {useOsmFallback ? 'خريطة الاستكشاف البديلة (OpenStreetMap)' : 'خريطة الاستكشاف والتحكم في محيط المنطقة'}
            </span>
            {isReverseGeocoding && (
              <span className="flex items-center gap-1 text-[#DD6B20] text-[10px]">
                <Loader2 className="h-3 w-3 animate-spin" />
                جاري قراءة العنوان الجغرافي...
              </span>
            )}
          </div>
          
          <div className="h-64 w-full relative z-0 bg-[#E0E2E7]" style={{ minHeight: '260px' }}>
            {useOsmFallback ? (
              /* حاوية خريطة OpenStreetMap التلقائية */
              <div ref={leafletContainerRef} className="h-full w-full relative z-0" />
            ) : (
              /* حاوية خريطة Google Maps */
              <MapErrorBoundary>
                <Map
                  defaultCenter={center}
                  defaultZoom={13}
                  mapId="DEMO_MAP_ID"
                  minZoom={8}
                  gestureHandling="greedy"
                  mapTypeControl={true}
                  streetViewControl={false}
                  fullscreenControl={true}
                  onCameraChanged={(e) => {
                     setCenter(e.detail.center);
                  }}
                  onDragEnd={(e) => {
                     if (e.map) {
                         const c = e.map.getCenter();
                         if (c) reverseGeocode(c.lat(), c.lng());
                     } else if (mapInstance) {
                         const c = mapInstance.getCenter();
                         if (c) reverseGeocode(c.lat(), c.lng());
                     }
                  }}
                  style={{ width: '100%', height: '100%' }}
                  internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                >
                  <MapCircle center={center} radius={mapRadius} />
                  <MapRefTracker setMap={setMapInstance} />
                </Map>
              </MapErrorBoundary>
            )}
            
            {/* دبوس مركز الخريطة العائم (مشترك بين Google و Leaflet ويضمن وجود الدبوس دائماً بالمنتصف) */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex flex-col items-center justify-center z-10 pb-10">
              <div className="relative flex items-center justify-center animate-bounce">
                <div className="absolute w-14 h-14 bg-[#DD6B20] rounded-full opacity-25 animate-ping" />
                <div className="relative bg-[#1A365D] text-white rounded-full p-2.5 border-[3px] border-white shadow-2xl flex items-center justify-center">
                  <MapPin className="h-6 w-6 text-white" fill="#DD6B20" />
                </div>
              </div>
              <div className="w-1 h-6 bg-gradient-to-b from-[#1A365D] to-transparent opacity-80" />
              <div className="absolute bottom-1 w-5 h-1.5 bg-black/40 rounded-[100%] blur-[2px] shadow-sm" />
            </div>
          </div>

          <div className="bg-slate-50 p-3 border-t border-slate-200 flex flex-col gap-2">
            <div className="flex justify-between items-center text-xs font-extrabold text-[#1A365D]">
              <span>محيط البحث الجغرافي اليدوي الحركي:</span>
              <span className="bg-indigo-100 text-indigo-950 font-black px-2 py-0.5 rounded border border-indigo-200">
                {(mapRadius / 1000).toFixed(1)} كم ({mapRadius} متر)
              </span>
            </div>
            
            <input
              type="range"
              min="500"
              max="5000"
              step="100"
              value={mapRadius}
              onChange={(e) => setMapRadius(Number(e.target.value))}
              className="w-full accent-[#1A365D] cursor-pointer h-1.5 bg-slate-200 rounded-lg appearance-none"
            />
          </div>
        </div>
      </div>
      
      <button
        type="button"
        onClick={handleStartSearch}
        disabled={isSearching}
        className="w-full bg-[#1A365D] text-white border-transparent hover:bg-[#1A365D] active:scale-95 text-white rounded-xl py-3.5 text-xs font-bold leading-none shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:bg-slate-300 disabled:cursor-not-allowed mt-4"
      >
        {isSearching ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-emerald-300" />
            <span>جاري تصفح الخرائط وسحب بيانات الاتصال...</span>
          </>
        ) : (
          <>
            <Search className="h-4 w-4 text-emerald-300" />
            <span>بدء سحب العملاء من الخرائط بالمنطقة المحددة</span>
          </>
        )}
      </button>

      {isSearching && (
        <div className="bg-slate-900 border border-indigo-950 p-7 rounded-2xl flex flex-col items-center justify-center gap-4 text-center text-slate-300 mt-4">
          <div className="relative w-20 h-20 rounded-full border border-indigo-500/30 flex items-center justify-center overflow-hidden bg-slate-950">
            <div className="absolute inset-1 rounded-full border border-indigo-500/20"></div>
            <div className="absolute w-2 h-2 bg-emerald-400 rounded-full animate-ping"></div>
            <MapPin className="h-6 w-6 text-emerald-400 absolute" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-black text-slate-100">جاري قراءة الإحداثيات والخرائط الفعلية...</span>
            <span className="text-[10px] text-gray-400 font-bold">يرجى الانتظار، جاري البحث عن جهات اتصال نشطة لتناسب منتجاتك.</span>
          </div>
        </div>
      )}
    </>
  );
}

export default function GmpMapEngine(props: GmpMapEngineProps) {
  return <MapSearchInner {...props} />;
}
