// @ts-nocheck
import React, { useEffect, useState, useRef } from 'react';
import { APIProvider, Map, Marker, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { Loader2, Search, MapPin, Navigation } from 'lucide-react';
import { showToast } from '../utils/toast';

const API_KEY =
  import.meta.env.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';
const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

interface GmpMapEngineProps {
  storeType: string | string[];
  batchSize: number;
  onResults: (results: any[]) => void;
  isSearching: boolean;
  setIsSearching: (b: boolean) => void;
}

// مكون مساعد لرسم دائرة نطاق البحث على الخريطة بشكل مرئي وتفاعلي
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
  }, [map]); // ننشئ الدائرة مرة واحدة فقط عند تحميل الخريطة

  // دالة مستقلة لتحديث الحجم والمكان بسلاسة عند تحريك المؤشر
  useEffect(() => {
    if (circleRef.current) {
      circleRef.current.setOptions({ center, radius });
    }
  }, [center, radius]);

  return null;
}

// Inner component to use maps library
function MapSearchInner({ storeType, batchSize, onResults, isSearching, setIsSearching }: GmpMapEngineProps) {
  const map = useMap();
  const placesLib = useMapsLibrary('places');
  const geocodingLib = useMapsLibrary('geocoding');
  
  const [center, setCenter] = useState({ lat: 30.0444, lng: 31.2357 }); // Cairo
  const [mapRadius, setMapRadius] = useState(1500);
  const [searchAreaText, setSearchAreaText] = useState('');
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isGpsLoading, setIsGpsLoading] = useState(false);

  // Sync isSearching prop with the button click inside or outside
  const handleStartSearch = async () => {
    if (!placesLib || !map) return;
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
        if (t === 'بقالة تموينية' || t === 'مواد تموينية') return { typeLabel: t, query: 'بدال تمويني جمعيتي مجمع استهلاكي' };
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

      const perQueryCount = Math.min(20, batchSize); // الحد الأقصى لكل استعلام للحصول على تغطية واسعة
      const allPlaces = new Map(); // نستخدم Map لمنع تكرار المحلات

      await Promise.all(queriesToRun.map(async (qObj) => {
        try {
          const response = await placesLib.Place.searchByText({
            textQuery: `${qObj.query} في ${finalArea}`,
            fields: ['id', 'displayName', 'formattedAddress', 'location', 'internationalPhoneNumber', 'rating', 'userRatingCount', 'types'],
            locationBias: {
              center: center,
              radius: mapRadius
            },
            maxResultCount: perQueryCount,
          });
          
          if (response && response.places) {
            response.places.forEach(p => {
               if (!allPlaces.has(p.id)) {
                 allPlaces.set(p.id, { place: p, typeLabel: qObj.typeLabel });
               }
            });
          }
        } catch (e) {
           console.warn(`Query failed for: ${qObj.query}`, e);
        }
      }));

      if (allPlaces.size > 0) {
        let mapped = Array.from(allPlaces.values()).map((data, idx) => {
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
            locationLink: `https://www.google.com/maps/search/?api=1&query=${p.location?.lat()},${p.location?.lng()}`,
            type: data.typeLabel
          };
        });
        
        // إلغاء تقييد النتائج الإجمالية لعرض كافة المحلات التي تم العثور عليها وتوسيع نطاق البحث
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
    if (!text.trim() || !geocodingLib || !map) return;
    setIsLocating(true);
    try {
      const geocoder = new geocodingLib.Geocoder();
      const res = await geocoder.geocode({ address: text + ' مصر' });
      if (res.results && res.results.length > 0) {
        const loc = res.results[0].geometry.location;
        const newCenter = { lat: loc.lat(), lng: loc.lng() };
        setCenter(newCenter);
        map.panTo(newCenter);
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
        if (map) map.panTo(newCenter);
        reverseGeocode(latitude, longitude);
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
        <label className="text-xs font-black text-[#1A365D]">المنطقة الجغرافية (المدينة / الحي):</label>
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
        
        {/* Interactive Google Map */}
        <div className="mt-3.5 border border-slate-200 rounded-xl overflow-hidden bg-slate-50 relative shadow-inner">
          <div className="bg-slate-100 px-3 py-2 border-b border-slate-200 flex justify-between items-center text-[11px] font-bold text-slate-700">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse inline-block"></span>
              خريطة الاستكشاف والتحكم في محيط المنطقة
            </span>
            {isReverseGeocoding && (
              <span className="flex items-center gap-1 text-[#DD6B20] text-[10px]">
                <Loader2 className="h-3 w-3 animate-spin" />
                جاري قراءة العنوان الجغرافي...
              </span>
            )}
          </div>
          
          <div className="h-64 w-full relative z-0 bg-[#E0E2E7]" style={{ minHeight: '260px' }}>
             <Map
              defaultCenter={center}
              defaultZoom={13}
              mapId="GMP_DEMO_MAP"
              minZoom={8}
              gestureHandling="greedy"
              mapTypeControl={false}
              streetViewControl={false}
              fullscreenControl={false}
              onDragEnd={() => {
                 if (map) {
                     const c = map.getCenter();
                     if (c) {
                        const newC = { lat: c.lat(), lng: c.lng() };
                        setCenter(newC);
                        reverseGeocode(newC.lat, newC.lng);
                     }
                 }
              }}
              style={{ width: '100%', height: '100%' }}
              internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            >
                <Marker position={center} draggable={true} onDragEnd={(e) => {
                    const lat = e.latLng?.lat();
                    const lng = e.latLng?.lng();
                    if (lat && lng) {
                        setCenter({lat, lng});
                        reverseGeocode(lat, lng);
                        if (map) map.panTo({lat, lng});
                    }
                }} />
                <MapCircle center={center} radius={mapRadius} />
            </Map>
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
            <span>جاري تصفح Google Maps وسحب بيانات الاتصال...</span>
          </>
        ) : (
          <>
            <Search className="h-4 w-4 text-emerald-300" />
            <span>بدء سحب العملاء من خرائط جوجل بالمنطقة المحددة</span>
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
            <span className="text-[10px] text-gray-400 font-bold">يرجى الانتظار، السيرفر يبحث عن جهات اتصال نشطة لتناسب منتجاتك.</span>
          </div>
        </div>
      )}
    </>
  );
}

const MAPS_LIBRARIES: any[] = ['places', 'geocoding'];

export default function GmpMapEngine(props: GmpMapEngineProps) {

  return (
    <APIProvider apiKey={API_KEY} version="quarterly" libraries={MAPS_LIBRARIES}>
      <MapSearchInner {...props} />
    </APIProvider>
  );
}
