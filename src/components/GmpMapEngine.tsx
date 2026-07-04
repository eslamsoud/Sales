// @ts-nocheck
import React, { useEffect, useState, useRef } from 'react';
import { APIProvider, Map, useMap, useMapsLibrary, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';
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

const getMarkerColor = (type: string) => {
  switch (type) {
    case 'هايبر ماركت':
      return '#1A365D'; // Dark Navy Blue
    case 'سوبر ماركت':
      return '#3182CE'; // Bright Blue
    case 'ميني ماركت':
      return '#319795'; // Teal
    case 'تجارة جملة':
      return '#805AD5'; // Purple
    case 'نصف جملة':
      return '#B794F4'; // Light Purple
    case 'توزيع أغذية':
      return '#DD6B20'; // Orange
    case 'حلواني ومخبز':
      return '#D53F8C'; // Pink/Magenta
    case 'عطارة':
      return '#D69E2E'; // Gold/Yellow
    case 'بقالة تموينية':
      return '#38A169'; // Green
    case 'مطاعم':
      return '#E53E3E'; // Red
    case 'مطابخ وتجهيزات':
      return '#9B2C2C'; // Dark Red
    default:
      return '#4A5568'; // Grey
  }
};

interface GmpMapEngineProps {
  storeType: string | string[];
  batchSize: number;
  onResults: (results: any[]) => void;
  isSearching: boolean;
  setIsSearching: (b: boolean) => void;
  apiKey?: string;
  results?: any[];
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

function MapSearchInner({ storeType, batchSize, onResults, isSearching, setIsSearching, apiKey, results = [] }: GmpMapEngineProps) {
  const [mapInstance, setMapInstance] = useState<any>(null);
  const placesLib = useMapsLibrary('places');
  const geocodingLib = useMapsLibrary('geocoding');
  const geometryLib = useMapsLibrary('geometry');
  const markerLib = useMapsLibrary('marker');

  const [center, setCenter] = useState({ lat: 30.5877, lng: 31.5020 }); // Zagazig
  const [mapRadius, setMapRadius] = useState(1500);
  const [searchAreaText, setSearchAreaText] = useState('');
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isGpsLoading, setIsGpsLoading] = useState(false);
  
  const [selectedGov, setSelectedGov] = useState('');
  const [selectedCity, setSelectedCity] = useState('');

  // تحديد ما إذا كنا سنستخدم بديل OpenStreetMap (تلقائي في حال عدم وجود مفتاح أو تعطل جوجل)
  const [useOsmFallback, setUseOsmFallback] = useState(false);
  const [osmRadarResults, setOsmRadarResults] = useState<any[]>([]);

  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const leafletContainerRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);
  const leafletCircleRef = useRef<any>(null);
  const leafletMarkersRef = useRef<any[]>([]);

  // مستمع لفشل مصادقة خرائط جوجل
  useEffect(() => {
    const originalHandler = window.gm_authFailure;
    window.gm_authFailure = () => {
      console.error("Google Maps auth failure detected.");
      
      const style = document.createElement('style');
      style.innerHTML = `
        .gm-err-container, .gm-err-content, .gm-err-title { display: none !important; opacity: 0 !important; visibility: hidden !important; }
        .gm-style-bg { display: none !important; }
        div[style*="background-color: rgba(15, 15, 15, 0.6)"] { display: none !important; }
        div[style*="z-index: 1000000"] { display: none !important; }
      `;
      document.head.appendChild(style);

      if (originalHandler) {
        try { originalHandler(); } catch (e) {}
      }
    };
    return () => {
      window.gm_authFailure = originalHandler;
    };
  }, []);

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

  // تحديث دبابيس المحلات المستكشفة على خريطة OpenStreetMap
  useEffect(() => {
    if (!useOsmFallback || !leafletMapRef.current || !window.L) return;

    // إزالة الدبابيس السابقة
    leafletMarkersRef.current.forEach(m => {
      try {
        m.remove();
      } catch (e) {}
    });
    leafletMarkersRef.current = [];

    const L = window.L;
    const drawPins = (placesList: any[], isRadar: boolean) => {
      if (placesList && placesList.length > 0) {
        placesList.forEach(lead => {
          if (lead.lat && lead.lng) {
            const markerColor = getMarkerColor(lead.type);
            const customIcon = L.divIcon({
              html: isRadar ? `
                <div style="position: relative; width: 24px; height: 24px; background-color: ${markerColor}; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5); opacity: 0.85; display: flex; align-items: center; justify-content: center; font-size: 12px; transform: translate(-12px, -12px);">📡</div>
              ` : `
                <div style="position: relative; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; transform: translate(-10px, -10px);">
                  <div style="background-color: ${markerColor}; width: 22px; height: 22px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center;">
                    <div style="width: 6px; height: 6px; background-color: white; border-radius: 50%;"></div>
                  </div>
                  <div style="position: absolute; bottom: 2px; left: 8px; width: 0; height: 0; border-left: 4px solid transparent; border-right: 4px solid transparent; border-top: 5px solid ${markerColor};"></div>
                </div>
              `,
              className: 'custom-leaflet-marker',
              iconSize: isRadar ? [24, 24] : [30, 30]
            });

            const marker = L.marker([lead.lat, lead.lng], { icon: customIcon })
              .addTo(leafletMapRef.current)
              .bindPopup(`
                <div style="text-align: right; font-family: sans-serif; direction: rtl;">
                  <b style="color: #1A365D;">${isRadar ? '[رادار] ' : ''}${lead.name}</b><br/>
                  <span style="font-size: 11px; color: ${markerColor}; font-weight: bold;">${lead.type}</span><br/>
                  <span style="font-size: 11px; color: #4A5568;">هاتف: ${lead.phone}</span>
                </div>
              `);
            leafletMarkersRef.current.push(marker);
          }
        });
      }
    };

    drawPins(results || [], false);
    drawPins(osmRadarResults || [], true);
    
  }, [useOsmFallback, results, osmRadarResults, leafletLoaded]);

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
          showToast(`📍 تم تحديد موقع: ${data[0].display_name}`);
        } else {
          showToast('⚠️ لم يتم العثور على نتائج لهذه المنطقة في الخرائط البديلة.');
        }
      } else {
        showToast('⚠️ تعذر الاتصال بخادم تحديد المواقع البديل.');
      }
    } catch (e) {
      console.error("OSM Geocoding Error:", e);
      showToast('⚠️ خطأ أثناء البحث عن إحداثيات المنطقة.');
    } finally {
      setIsLocating(false);
    }
  };

  // البحث عن المحلات في OSM (Overpass API)
  const handleOsmSearch = async () => {
    setIsSearching(true);
    setUseOsmFallback(false); // البقاء على خريطة جوجل لعرض الدبابيس
    setOsmRadarResults([]); // إفراغ الرادار القديم
    try {
      const finalArea = searchAreaText.trim() || 'الزقازيق';
      const selectedTypesArray = Array.isArray(storeType) ? storeType : [storeType];
      
      let typesQuery = '';
      const buildOsmTypes = (t: string) => {
        if (t === 'سوبر ماركت') return 'supermarket|convenience|deli|food';
        if (t === 'هايبر ماركت') return 'supermarket|wholesale';
        if (t === 'ميني ماركت') return 'convenience|kiosk';
        if (t === 'حلواني ومخبز') return 'bakery|pastry|confectionery';
        if (t === 'مطاعم') return 'restaurant|fast_food';
        if (t === 'عطارة') return 'spices|herbalist';
        if (t === 'تجارة جملة') return 'wholesale';
        if (t === 'بقالة تموينية') return 'grocery|convenience';
        return 'shop|retail';
      };
      
      const matchedTypes = selectedTypesArray.length === 0
        ? 'supermarket|convenience|kiosk|bakery|spices|wholesale|grocery|food|deli|pastry|restaurant|fast_food'
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
      
      const overpassEndpoints = [
        'https://overpass-api.de/api/interpreter',
        'https://lz4.overpass-api.de/api/interpreter',
        'https://z.overpass-api.de/api/interpreter'
      ];

      let osmResponse = null;
      for (const endpoint of overpassEndpoints) {
        try {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'data=' + encodeURIComponent(overpassQuery)
          });
          if (res.ok) {
            osmResponse = res;
            break; // نجح الاتصال، أوقف المحاولة مع الخوادم الأخرى
          }
        } catch (e) {
          console.warn(`OSM endpoint ${endpoint} failed. Trying next...`);
        }
      }
      
      if (!osmResponse) throw new Error('تعذر جلب البيانات من خوادم الخرائط المفتوحة. يرجى التأكد من اتصال الإنترنت أو المحاولة لاحقاً.');
      
      const data = await osmResponse.json();
      if (data && data.elements && data.elements.length > 0) {
        let mapped = data.elements.map((el: any, idx: number) => {
          const tags = el.tags || {};
          const name = tags.name || tags.brand || tags.shop || tags.amenity || 'محل تجاري';
          const phone = tags.phone || tags['contact:phone'] || 'غير مسجل';
          const street = tags['addr:street'] || tags['addr:full'] || finalArea;
          const lat = el.lat || el.center?.lat || center.lat;
          const lon = el.lon || el.center?.lon || center.lng;
          
          let shopType = 'نشاط تجاري';
          if (tags.shop === 'supermarket') {
            shopType = (tags.shop_profile === 'hypermarket' || name.includes('هايبر')) ? 'هايبر ماركت' : 'سوبر ماركت';
          }
          else if (tags.shop === 'convenience' || tags.shop === 'kiosk') shopType = 'ميني ماركت';
          else if (tags.shop === 'bakery' || tags.shop === 'pastry') shopType = 'حلواني ومخبز';
          else if (tags.amenity === 'restaurant' || tags.amenity === 'fast_food' || tags.amenity === 'cafe') shopType = 'مطاعم';
          else if (tags.shop === 'spices' || tags.shop === 'herbalist') shopType = 'عطارة';
          else if (tags.shop === 'wholesale') shopType = 'تجارة جملة';
          else if (tags.shop === 'grocery') shopType = 'بقالة تموينية';
          
          return {
            id: `osm-lead-${el.id || Date.now()}-${idx}`,
            name: name,
            phone: phone,
            area: finalArea,
            detailedAddress: street,
            rating: null,
            reviewsCount: null,
            locationLink: `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`,
            type: shopType,
            lat: lat,
            lng: lon
          };
        });
        setOsmRadarResults(mapped);
        showToast(`📡 رادار: تم رصد ${mapped.length} نشاط في النطاق المحدد (دبابيس استرشادية).`);
      } else {
        setOsmRadarResults([]);
        showToast('ℹ️ رادار: لم يتم رصد كثافة للأنشطة في هذا النطاق.');
      }
    } catch (err: any) {
      console.error('OSM Search Error:', err);
      showToast('⚠️ خطأ في رادار البحث: ' + err.message);
      setOsmRadarResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // دالة البحث الكلاسيكي في خرائط جوجل في حال عدم تفعيل Places API (New)
  const searchClassicPlaces = (queryText: string, isRadarOnly: boolean = false): Promise<any[]> => {
    return new Promise((resolve, reject) => {
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
        }, async (results, status) => {
          try {
            if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
              // الحد من عدد طلبات التفاصيل لتوفير الكوتا وتسريع الأداء
              const placesToFetch = results.slice(0, batchSize);
              
              if (isRadarOnly) {
                 resolve(placesToFetch);
                 return;
              }
              
              const detailedResults = [];
              
              for (const place of placesToFetch) {
                if (!place.place_id) {
                  detailedResults.push(place);
                  continue;
                }
                
                // ⏳ تأخير 300 ملي ثانية بين كل طلب تفاصيل لمنع خطأ OVER_QUERY_LIMIT (Rate Limiting)
                await new Promise(r => setTimeout(r, 300));
                
                const detail = await new Promise<any>((resolveDetail) => {
                  try {
                    service.getDetails({
                      placeId: place.place_id,
                      fields: ['formatted_phone_number']
                    }, (details, detailStatus) => {
                      if (detailStatus === window.google.maps.places.PlacesServiceStatus.OK && details) {
                        place.formatted_phone_number = details.formatted_phone_number;
                      }
                      resolveDetail(place);
                    });
                  } catch (err) {
                    resolveDetail(place);
                  }
                });
                detailedResults.push(detail);
              }
              
              // إضافة العناصر المتبقية التي لم نجلب تفاصيلها لتظهر بالنتائج بدون رقم هاتف بدلاً من حذفها
              const remainingPlaces = results.slice(batchSize);
              resolve([...detailedResults, ...remainingPlaces]);
            } else if (status === window.google.maps.places.PlacesServiceStatus.REQUEST_DENIED || status === 'REQUEST_DENIED') {
              reject(new Error("REQUEST_DENIED from Google Cloud"));
            } else if (status === window.google.maps.places.PlacesServiceStatus.OVER_QUERY_LIMIT || status === 'OVER_QUERY_LIMIT') {
              reject(new Error("OVER_QUERY_LIMIT from Google Cloud"));
            } else {
              resolve([]);
            }
          } catch (callbackErr) {
            console.error("Error in textSearch callback:", callbackErr);
            resolve(results || []);
          }
        });
      } catch (e) {
        console.error("Classic search failed:", e);
        resolve([]);
      }
    });
  };

  // البحث الرئيسي
  const handleStartSearch = async (isRadarOnly: boolean = false) => {
    if (useOsmFallback) {
      await handleOsmSearch();
      return;
    }

    if (!placesLib || !mapInstance) {
      showToast('⚠️ لم يتم تحميل خرائط جوجل بالكامل بعد أو هناك مشكلة في الاتصال. يرجى الانتظار أو استخدام الخرائط البديلة (OpenStreetMap).');
      return;
    }
    
    setIsSearching(true);
    setOsmRadarResults([]); // إفراغ الرادار عند بدء الاستخراج الفعلي
    
    try {
      const finalArea = searchAreaText.trim() || 'الزقازيق';
      const selectedTypesArray = Array.isArray(storeType) ? storeType : [storeType];

      let queriesToRun: { typeLabel: string; query: string }[] = [];
      
      const buildQueries = (t: string) => {
        if (t === 'سوبر ماركت') return { typeLabel: t, query: 'سوبر ماركت' };
        if (t === 'هايبر ماركت') return { typeLabel: t, query: 'هايبر ماركت' };
        if (t === 'ميني ماركت') return { typeLabel: t, query: 'بقالة' };
        if (t === 'حلواني ومخبز') return { typeLabel: t, query: 'مخبز' };
        if (t === 'مطاعم') return { typeLabel: t, query: 'مطعم' };
        if (t === 'بقالة تموينية') return { typeLabel: t, query: 'تموين مواد غذائية' };
        if (t === 'عطارة') return { typeLabel: t, query: 'عطارة' };
        if (t === 'تجارة جملة') return { typeLabel: t, query: 'تجارة جملة مواد غذائية' };
        if (t === 'نصف جملة') return { typeLabel: t, query: 'نصف جملة مواد غذائية' };
        if (t === 'توزيع أغذية') return { typeLabel: t, query: 'توزيع مواد غذائية' };
        return { typeLabel: 'نشاط تجاري', query: 'بقالة مواد غذائية' };
      };

      if (selectedTypesArray.length === 0) {
        const allAppTypes = ['سوبر ماركت', 'ميني ماركت', 'هايبر ماركت', 'بقالة تموينية', 'تجارة جملة', 'نصف جملة', 'توزيع أغذية', 'حلواني ومخبز', 'عطارة', 'مطاعم'];
        queriesToRun = allAppTypes.map(t => buildQueries(t));
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
        await new Promise(resolve => setTimeout(resolve, 2000));
        try {
          let places: any[] = [];
          
          // محاولة جلب البيانات باستخدام Places API (New) الحديثة مع تحديد نطاق جغرافي مفضل
          try {
            const fields = isRadarOnly 
              ? ['id', 'displayName', 'formattedAddress', 'location', 'rating', 'userRatingCount', 'types']
              : ['id', 'displayName', 'formattedAddress', 'location', 'internationalPhoneNumber', 'rating', 'userRatingCount', 'types'];

            const response = await placesLib.Place.searchByText({
              textQuery: `${qObj.query} ${finalArea}`,
              fields: fields,
              maxResultCount: perQueryCount,
              locationBias: (center.lat === 30.5877 && center.lng === 31.5020 && finalArea !== 'الزقازيق') ? undefined : {
                circle: {
                  center: { lat: center.lat, lng: center.lng },
                  radius: mapRadius
                }
              }
            });
            places = response?.places || [];
          } catch (modernError: any) {
            console.warn("Modern Places API (New) failed or not active:", modernError);
            if (modernError && modernError.message && (modernError.message.includes('429') || modernError.message.includes('Too Many Requests'))) {
              throw modernError;
            }
          }
          
          // إذا لم نجد نتائج بالبحث الحديث (أو حدث خطأ)، نقوم بالبحث الكلاسيكي الأكثر موثوقية وشمولاً
          if (!places || places.length === 0) {
            try {
              const classicResults = await searchClassicPlaces(`${qObj.query} ${finalArea}`, isRadarOnly);
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
            } catch (classicError: any) {
              console.error("Classic search failed as well:", classicError);
              throw classicError;
            }
          }
          
          if (places && places.length > 0) {
            places.forEach(p => {
              // استبعاد الأماكن غير ذات الصلة تماماً (مستشفيات، سينما، صيدليات، مدارس، الخ)
              const pTypes = p.types || [];

              // الحجب الصارم الذي لا استثناء فيه
              const isStrictlyIrrelevant = pTypes.some((t: string) => [
                'hospital', 'pharmacy', 'doctor', 'health', 'dentist', 'clinic',
                'school', 'university', 'gym', 'spa', 'beauty_salon', 'hair_care', 'bank', 'atm',
                'police', 'government_office', 'local_government_office', 'lawyer', 'real_estate_agency',
                'car_repair', 'car_wash', 'gas_station', 'lodging', 'hotel', 'museum', 'park', 'stadium',
                'mosque', 'church', 'place_of_worship', 'pet_store', 'bicycle_store', 'car_dealer',
                'campground', 'rv_park', 'transit_station', 'airport', 'subway_station', 'train_station'
              ].includes(t));

              if (isStrictlyIrrelevant) return; // تجاهل فوري

              // التحقق من التصنيفات الغذائية المباشرة
              const isFoodRelated = pTypes.some((t: string) => [
                'supermarket', 'grocery_or_supermarket', 'convenience_store', 
                'food', 'bakery', 'restaurant', 'meal_delivery', 'meal_takeaway'
              ].includes(t));

              // الحجب المرن للأشياء التي قد تكون ملحقة بماركت كبير
              const softIrrelevant = pTypes.some((t: string) => [
                'clothing_store', 'shoe_store', 'furniture_store', 'jewelry_store', 'electronics_store', 
                'hardware_store', 'home_goods_store', 'book_store', 'cafe'
              ].includes(t));

              if (softIrrelevant && !isFoodRelated) {
                return;
              }

              const pName = (p.displayName || p.name || '').toLowerCase();
              if (pName && (
                pName.includes('مستشفى') || pName.includes('صيدلية') || pName.includes('عيادة') || 
                pName.includes('مدرسة') || pName.includes('بنك') || pName.includes('كافيه') || 
                pName.includes('قهوة') || pName.includes('مقهى') || pName.includes('ملابس') || 
                pName.includes('أحذية') || pName.includes('كمبيوتر') || pName.includes('موبايل') || 
                pName.includes('أدوية')
              )) {
                 return; // الحجب الصارم بالاسم
              }

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
                    internationalPhoneNumber: isRadarOnly ? 'في انتظار الاستخراج ⏳' : (p.internationalPhoneNumber || p.formatted_phone_number || 'غير مسجل'),
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
        } catch (e: any) {
           console.error(`Query failed for: ${qObj.query}`, e);
           throw e; // إعادة رمي الخطأ ليتم التقاطه في الـ catch الخارجي وإظهار التنبيه للمستخدم
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
            placeId: p.id,
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


        onResults(mapped);
      } else {
        onResults([]);
      }
    } catch (err: any) {
      console.error('Google Maps API Error:', err);
      
      const errMsg = err.message || JSON.stringify(err);
      if (errMsg.includes('OVER_QUERY_LIMIT') || errMsg.includes('429') || errMsg.includes('Too Many Requests')) {
        showToast('⚠️ تم استهلاك الحد الأقصى لطلبات خرائط جوجل (OVER_QUERY_LIMIT). يرجى المحاولة بعد قليل.');
        onResults([]);
      } else {
        showToast('⚠️ رد من Google Cloud: ' + errMsg);
        onResults([]);
      }
    } finally {
      setIsSearching(false);
    }
  };

  const geocodeAndGo = async (text: string) => {
    if (useOsmFallback) {
      await geocodeOsm(text);
      return;
    }

    if (!text.trim()) return;

    if (!geocodingLib || !mapInstance) {
      showToast('⚠️ لم يتم تحميل أدوات البحث الجغرافي لخرائط جوجل بعد. يرجى الانتظار أو استخدام البحث البديل (OpenStreetMap).');
      return;
    }
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
              title="تحديد الموقع الحالي للبحث"
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
        
        {/* أداة اختيار محرك الخرائط */}
        <div className="flex bg-[#F1F5F9] p-1 rounded-xl mt-3 select-none border border-slate-200">
          <button
            type="button"
            onClick={() => setUseOsmFallback(false)}
            className={`flex-1 px-2 py-2 text-[11px] sm:text-xs font-black rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${!useOsmFallback ? 'bg-white text-[#1A365D] shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}
          >
            خرائط جوجل
          </button>
          <button
            type="button"
            onClick={() => setUseOsmFallback(true)}
            className={`flex-1 px-2 py-2 text-[11px] sm:text-xs font-black rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${useOsmFallback ? 'bg-white text-[#DD6B20] shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}
          >
            (OpenStreetMap)
          </button>
        </div>

        {/* الخريطة التفاعلية */}
        <div className="mt-3.5 border border-slate-200 rounded-xl overflow-hidden bg-slate-50 relative shadow-inner">
          <div className="bg-slate-100 px-3 py-2 border-b border-slate-200 flex justify-between items-center text-[11px] font-bold text-slate-700">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse inline-block"></span>
              {useOsmFallback ? 'خريطة الاستكشاف البديلة (OpenStreetMap)' : 'خريطة الاستكشاف والتحكم في محيط المنطقة'}
            </span>
          <div className="flex items-center gap-2">
            {isReverseGeocoding && (
              <span className="flex items-center gap-1 text-[#DD6B20] text-[10px]">
                <Loader2 className="h-3 w-3 animate-spin" />
                جاري قراءة العنوان...
              </span>
            )}
            <button 
              type="button" 
              onClick={() => useOsmFallback ? reverseGeocodeOsm(center.lat, center.lng) : reverseGeocode(center.lat, center.lng)}
              className="bg-indigo-100 hover:bg-indigo-200 text-indigo-800 px-2 py-1 rounded transition-colors text-[10px] cursor-pointer border border-indigo-200 font-bold"
            >
              قراءة عنوان المؤشر الحالي 📍
            </button>
          </div>
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
                  mapTypeControl={false}
                  streetViewControl={true}
                  fullscreenControl={true}
                  onCameraChanged={(e) => {
                     setCenter(e.detail.center);
                  }}
                  style={{ width: '100%', height: '100%' }}
                  internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                >
                  <MapRefTracker setMap={setMapInstance} />
                  <MapCircle center={center} radius={mapRadius} />
                  
                  {/* دبوس مركز الدائرة (نقطة البحث الأساسية) */}
                  {markerLib && (window as any).google?.maps?.marker?.AdvancedMarkerElement && (
                    <AdvancedMarker position={center} zIndex={9999} title="مركز دائرة البحث الحالي">
                      <Pin background="#ef4444" borderColor="#7f1d1d" glyphColor="#ffffff" />
                    </AdvancedMarker>
                  )}
                  
                  {results && results.length > 0 && markerLib && (window as any).google?.maps?.marker?.AdvancedMarkerElement && results.map((lead: any) => {
                    if (lead.lat && lead.lng) {
                      const markerColor = getMarkerColor(lead.type);
                      return (
                        <AdvancedMarker key={lead.id} position={{ lat: lead.lat, lng: lead.lng }} title={lead.name}>
                          <Pin background={markerColor} glyphColor="#ffffff" borderColor="#ffffff" />
                        </AdvancedMarker>
                      );
                    }
                    return null;
                  })}
                </Map>
              </MapErrorBoundary>
            )}
          </div>
        </div>

        {/* شريط التحكم في محيط الدائرة (نطاق البحث) */}
        <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 mt-3 flex flex-col gap-2 text-right" dir="rtl">
          <label className="text-[11px] font-black text-[#1A365D] flex items-center justify-between">
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-[#DD6B20]" />
              تحديد محيط دائرة البحث (بالأمتار):
            </span>
            <span className="text-[#DD6B20] bg-white px-2 py-0.5 rounded-lg border border-indigo-200 shadow-sm">{mapRadius} متر</span>
          </label>
          <input
            type="range"
            min="500"
            max="15000"
            step="500"
            value={mapRadius}
            onChange={(e) => setMapRadius(Number(e.target.value))}
            className="w-full cursor-pointer accent-[#DD6B20]"
          />
          <div className="flex justify-between text-[9px] font-bold text-slate-400 px-1" dir="ltr">
            <span>500m</span>
            <span>15km</span>
          </div>
        </div>

        {/* أزرار الرادار وجلب العملاء (منفصلين تماماً - لكل زر وظيفته) */}
        <div className="flex flex-col gap-2 mt-3">
          <button
            type="button"
            onClick={() => {
              setUseOsmFallback(false);
              handleStartSearch(true);
            }}
            disabled={isSearching || isLocating}
            className="w-full bg-slate-800 hover:bg-slate-700 text-white py-3.5 rounded-xl font-black shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 border-transparent"
          >
            {isSearching ? <Loader2 className="h-5 w-5 animate-spin" /> : <MapPin className="h-5 w-5 text-sky-400" />}
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-1.5">
                <span>الرادار 📡</span>
                {results && results.length > 0 && !isSearching && (
                  <span className="bg-sky-500/30 text-sky-100 text-[10px] px-2 py-0.5 rounded-full font-sans border border-sky-400/30">
                    {results.length} دبابيس
                  </span>
                )}
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setUseOsmFallback(false);
              handleStartSearch(false);
            }}
            disabled={isSearching || isLocating}
            className="w-full bg-[#DD6B20] hover:bg-[#C05621] text-white py-3.5 rounded-xl font-black shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 border-transparent"
          >
            {isSearching ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-1.5">
                <span>جلب العملاء 🚀</span>
              </div>
            </div>
          </button>
        </div>
      </div>
    </>
  );
}

export default function GmpMapEngine(props: GmpMapEngineProps) {
  return <MapSearchInner {...props} />;
}