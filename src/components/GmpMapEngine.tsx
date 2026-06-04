import React, { useEffect, useState, useRef } from 'react';
import { APIProvider, Map, AdvancedMarker, Pin, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { Loader2, Search, MapPin } from 'lucide-react';

interface GmpMapEngineProps {
  storeType: string;
  batchSize: number;
  onResults: (results: any[]) => void;
  isSearching: boolean;
  setIsSearching: (b: boolean) => void;
}

const MapCircle = ({ center, radius }: { center: { lat: number, lng: number }, radius: number }) => {
  const map = useMap();
  const circleRef = useRef<any>(null);

  useEffect(() => {
    if (!map || !(window as any).google) return;
    if (!circleRef.current) {
      circleRef.current = new (window as any).google.maps.Circle({
        strokeColor: "#E11D48",
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: "#BE123C",
        fillOpacity: 0.15,
        map,
      });
    }
    circleRef.current.setCenter(center);
    circleRef.current.setRadius(radius);
  }, [map, center, radius]);
  
  useEffect(() => {
    return () => { if (circleRef.current) circleRef.current.setMap(null); };
  }, []);

  return null;
};

// Inner component to use maps library
function MapSearchInner({ storeType, batchSize, onResults, isSearching, setIsSearching }: GmpMapEngineProps) {
  const map = useMap('main-map');
  const placesLib = useMapsLibrary('places');
  const geocodingLib = useMapsLibrary('geocoding');
  
  const [center, setCenter] = useState({ lat: 30.0444, lng: 31.2357 }); // Cairo
  const [mapRadius, setMapRadius] = useState(1500);
  const [searchAreaText, setSearchAreaText] = useState('');
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  // Sync isSearching prop with the button click inside or outside
  const handleStartSearch = async () => {
    if (!placesLib || !map) return;
    setIsSearching(true);
    
    try {
      const typeMap: Record<string, string> = {
        'سوبر ماركت': 'supermarket',
        'ميني ماركت': 'convenience_store',
        'هايبر ماركت': 'supermarket',
        'حلواني ومخبز': 'bakery',
        'مطاعم': 'restaurant',
        'بقالة تموينية': 'grocery_store',
        'مواد تموينية': 'grocery_store',
        'عطارة': 'spice_store',
        'الكل': 'store'
      };

      const finalArea = searchAreaText.trim() || 'القاهرة';

      const response = await placesLib.Place.searchNearby({
        fields: ['id', 'displayName', 'formattedAddress', 'location', 'internationalPhoneNumber', 'rating', 'userRatingCount', 'types'],
        locationRestriction: {
          center: center,
          radius: mapRadius
        },
        includedTypes: [typeMap[storeType] || 'store'],
        maxResultCount: batchSize > 20 ? 20 : batchSize,
      });

      if (response && response.places) {
        const mapped = response.places.map((p: any, idx: number) => {
          let phone = p.internationalPhoneNumber || 'غير مسجل';
          let detailedAddress = p.formattedAddress || finalArea;
          let rating = p.rating ? parseFloat(p.rating.toFixed(1)) : null;
          let reviewsCount = p.userRatingCount || null;
          let type = storeType;
          if (p.types && p.types.length > 0) {
              if (p.types.includes('supermarket')) type = 'سوبر ماركت';
              else if (p.types.includes('bakery')) type = 'حلواني ومخبز';
              else if (p.types.includes('restaurant')) type = 'مطعم';
          }
          
          return {
            id: `gmp-lead-${p.id || Date.now()}-${idx}`,
            name: p.displayName || 'محل تجاري',
            phone,
            area: finalArea,
            detailedAddress,
            rating,
            reviewsCount,
            locationLink: `https://www.google.com/maps/search/?api=1&query=${p.location?.lat()},${p.location?.lng()}`,
            type
          };
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
      
      alert('حدث خطأ أثناء الاتصال بخوادم خرائط جوجل: ' + errorMessage);
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
        map.setCenter(newCenter);
        map.setZoom(14);
      } else {
        alert('لم يتم العثور على المنطقة الجغرافية، جرب كتابة اسم أقرب مدينة أو منطقة مشهورة.');
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
        let bestName = res.results[0].address_components.find((c: any) => c.types.includes('sublocality'))?.long_name || 
                       res.results[0].address_components.find((c: any) => c.types.includes('locality'))?.long_name || 
                       res.results[0].formatted_address;
        setSearchAreaText(bestName || '');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsReverseGeocoding(false);
    }
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
              onClick={() => geocodeAndGo(searchAreaText)}
              disabled={isLocating}
              className="bg-[#2B6CB0] hover:bg-[#2C5282] text-white px-4 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center transition-colors disabled:opacity-50"
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
              id="main-map"
              defaultCenter={{ lat: 30.0444, lng: 31.2357 }}
              defaultZoom={13}
              mapId="GMP_DEMO_MAP"
              minZoom={8}
              onDragend={(e) => {
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
                <AdvancedMarker position={center} draggable onDragEnd={(e) => {
                    const lat = e.latLng?.lat();
                    const lng = e.latLng?.lng();
                    if (lat && lng) {
                        setCenter({lat, lng});
                        reverseGeocode(lat, lng);
                        if (map) map.panTo({lat, lng});
                    }
                }}>
                    <Pin background="#E11D48" glyphColor="#fff" borderColor="#BE123C" />
                </AdvancedMarker>
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

export default function GmpMapEngine(props: GmpMapEngineProps) {
  const [mapError, setMapError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string>(
    localStorage.getItem('gmap_api_key_sys') ||
    (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
    (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY || ''
  );

  useEffect(() => {
    if (!apiKey) {
      fetch('https://sales-six-pied.vercel.app/api/keys/maps')
        .then(res => res.json())
        .then(data => {
          if (data.key) {
            setApiKey(data.key);
            localStorage.setItem('gmap_api_key_sys', data.key);
          }
        })
        .catch(console.error);
    }
  }, [apiKey]);

  useEffect(() => {
    (window as any).gm_authFailure = () => {
      setMapError("فشل مصادقة Google Maps API. يرجى التأكد من تفعيل الدفع (Billing)، إضافة النطاق الحالي ضمن (HTTP Referrers) في الـ (Credentials) وتفعيل الـ (APIs) المطلوبة في حسابك على Google Cloud.");
    };

    const handleWindowError = (e: ErrorEvent) => {
      if (e.message && e.message.includes("Google Maps JavaScript API error")) {
         setMapError(`رسالة من خوادم جوجل: ${e.message}. يرجى مراجعة إعدادات (Billing / Referrers) في حسابك.`);
      }
    };
    window.addEventListener('error', handleWindowError);
    return () => window.removeEventListener('error', handleWindowError);
  }, []);

  const hasValidKey = Boolean(apiKey) && apiKey !== 'YOUR_API_KEY';

  if (!hasValidKey) {
    return (
      <div className="flex flex-col items-center justify-center p-6 bg-amber-50 rounded-xl border border-amber-200 mt-4 text-center text-amber-900">
        <h2 className="text-lg font-bold mb-2">مفتاح خرائط جوجل غير متوفر</h2>
        <p className="text-xs mb-4">للتمكن من استكشاف العملاء، يرجى التأكد من حقن المفتاح السري من خوادم Vercel:</p>
        <ul className="text-xs text-right list-decimal list-inside space-y-1 bg-[#FFFFFF] p-3 rounded-lg border border-amber-100">
          <li>افتح إعدادات مشروعك في منصة <strong>Vercel</strong> &gt; Settings &gt; Environment Variables.</li>
          <li>أضف متغير جديد باسم <code>VITE_GOOGLE_MAPS_PLATFORM_KEY</code> والصق مفتاحك الخاص أمامه.</li>
          <li>قم بإعادة بناء المشروع (Redeploy) ليتم سحب المفتاح وتفعيل الخرائط للجميع بأمان.</li>
        </ul>
      </div>
    );
  }

  if (mapError) {
    return (
      <div className="flex flex-col items-center justify-center p-6 bg-red-50 rounded-xl border border-red-200 mt-4 text-center text-red-900">
        <h2 className="text-lg font-bold mb-2">تعذر تحميل خرائط جوجل (خطأ مصادقة)</h2>
        <p className="text-xs mb-4 font-bold leading-relaxed whitespace-pre-wrap">{mapError}</p>
        <div className="text-right text-[11px] bg-white p-3 rounded border border-red-100 w-full">
            <p><strong>حل مشكلة "This page can't load Google Maps correctly" (رغم امتلاك مفتاح رسمي):</strong></p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-red-800">
                <li><strong>متغيرات Vercel:</strong> تأكد أنك أضفت المفتاح في إعدادات Vercel باسم <code>VITE_GOOGLE_MAPS_PLATFORM_KEY</code> (يجب أن يبدأ بـ VITE ليقرأه المتصفح)، ثم قمت بعمل <strong>Redeploy</strong>.</li>
                <li><strong>الدفع (Billing):</strong> تأكد من ربط بطاقة بنكية بحسابك في Google Cloud (الخرائط تتطلب تفعيل الدفع حتى لو كانت مجانية الاستخدام).</li>
                <li><strong>القيود (Restrictions):</strong> تأكد أن المفتاح غير مقيد، أو أضف رابط التطبيق الحالي <code>{window.location.origin}</code> في قسم <strong>HTTP Referrers</strong>.</li>
                <li><strong>الخدمات (APIs):</strong> تأكد من تفعيل <strong>Maps JavaScript API</strong> و <strong>Places API (New)</strong> و <strong>Geocoding API</strong>.</li>
            </ul>
        </div>
      </div>
    );
  }

  return (
    <APIProvider apiKey={apiKey} version="weekly">
      <MapSearchInner {...props} />
    </APIProvider>
  );
}
