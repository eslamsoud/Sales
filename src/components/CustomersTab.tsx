import { confirmDialog } from '../utils/confirm';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Customer, AppSettings } from '../types';
import { Users, Plus, MapPin, Search, Phone, ExternalLink, Trash2, ArrowRight, Compass, Check, Loader2, Star, MessageSquare, Send, Copy, Sparkles } from 'lucide-react';
import SecurePhoneDisplay from './SecurePhoneDisplay';

interface CustomersTabProps {
  customers: Customer[];
  onAddCustomer: (customer: Omit<Customer, 'id'>) => void;
  onEditCustomer: (customer: Customer) => void;
  onDeleteCustomer: (id: string) => void;
  onGoBack: () => void;
  settings: AppSettings;
  permittedSubTabs?: string[];
}

export default function CustomersTab({ customers, onAddCustomer, onEditCustomer, onDeleteCustomer, onGoBack, settings, permittedSubTabs }: CustomersTabProps) {
  const [activeTab, setActiveTab] = useState<'list' | 'maps_finder' | 'google_leads'>(() => {
    if (permittedSubTabs && permittedSubTabs.length > 0) {
      if (permittedSubTabs.includes('customers_list')) return 'list';
      if (permittedSubTabs.includes('customers_maps_finder')) return 'maps_finder';
    }
    return 'list';
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [area, setArea] = useState('');
  const [customArea, setCustomArea] = useState('');
  const [locationLink, setLocationLink] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingGeo, setLoadingGeo] = useState(false);
  const [geoStatusMsg, setGeoStatusMsg] = useState('');
  const [waLoadingId, setWaLoadingId] = useState<string | null>(null);

  React.useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [activeTab]);

  const handleGenerateAndSendWA = async (customer: Customer) => {
    setWaLoadingId(customer.id);
    try {
      const userMessage = `قم بصياغة رسالة واتساب لعميل اسمه: ${customer.name} (حالة العميل: مسجل بقاعدة العملاء ومحله في منطقة: ${customer.area}).
التعليمات والخطوط العريضة الخاصة بمدير المبيعات (استخدمها للتفاوض والمتابعة):
"${settings.aiRetentionGuidelines || 'قدم رسالة ترحيبية تشجعه على استمرار التعامل معنا، مع توضيح أننا نهتم بوجوده معنا كشريك نجاح.'}"
أريد فقط نص الرسالة بدون أي مقدمات أخرى لتكون جاهزة للإرسال مباشرة للعميل وبصيغة جذابة.`;

      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: 'أنت مساعد مبيعات احترافي.',
          history: [],
          message: userMessage
        })
      });

      if (!response.ok) {
        throw new Error('فشل في الاتصال بمساعد الذكاء الاصطناعي');
      }

      const data = await response.json();
      const messageText = encodeURIComponent(data.text);
      let phone = customer.phone;
      if (phone.startsWith('0')) {
        phone = '20' + phone.substring(1);
      }
      window.open(`https://wa.me/${phone}?text=${messageText}`, '_blank');
    } catch (err: any) {
      alert("حدث خطأ أثناء صياغة رسالة الواتساب عبر الذكاء الاصطناعي: " + err.message);
    } finally {
      setWaLoadingId(null);
    }
  };

  // Watchlist/Staging for prospects generated from Google Maps finder
  const [googleLeads, setGoogleLeads] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('google_leads_staging_sys');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // Automatically save googleLeads inside localStorage on change
  React.useEffect(() => {
    localStorage.setItem('google_leads_staging_sys', JSON.stringify(googleLeads));
  }, [googleLeads]);

  const DEFAULT_AREAS = ['الزقازيق', 'ميت غمر', 'بدر', 'العاشر من رمضان', 'بلبيس', 'القاهرة'];
  const registeredAreas = Array.from(new Set(customers.map(c => c.area).filter(Boolean)));
  const allAreas = Array.from(new Set([...DEFAULT_AREAS, ...registeredAreas]));

  // Google Maps Lead Finder State
  const [selectedSearchArea, setSelectedSearchArea] = useState('');
  const [storeType, setStoreType] = useState('سوبر ماركت ومينى ماركت');
  const [isSearchingMaps, setIsSearchingMaps] = useState(false);
  const [mapsResults, setMapsResults] = useState<any[]>([]);
  const [addedLeadIds, setAddedLeadIds] = useState<string[]>([]);

  // Leaflet Map states & refs for visual area selector
  const mapRef = React.useRef<any>(null);
  const markerRef = React.useRef<any>(null);
  const circleRef = React.useRef<any>(null);
  const [mapRadius, setMapRadius] = useState(1500); // 1.5 km by default
  const [isLocatingOnMap, setIsLocatingOnMap] = useState(false);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);

  // Reverse geocode coordinates to structured Arabic address text with proper Egypt fallback
  const triggerReverseGeocode = async (lat: number, lng: number) => {
    setIsReverseGeocoding(true);
    try {
      const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ar`, {
        headers: {
          'User-Agent': 'SufanaAppletExplorer/1.0'
        }
      });
      if (resp.ok) {
        const data = await resp.json();
        const addr = data.address || {};
        const placeName = addr.suburb || addr.quarter || addr.neighbourhood || addr.city || addr.town || addr.village || addr.county || '';
        const finalPlace = [placeName, addr.city || addr.state].filter(Boolean).filter((v: any, i: number, a: any[]) => a.indexOf(v) === i).join('، ');
        
        if (finalPlace && finalPlace.trim()) {
          setSelectedSearchArea(finalPlace.trim());
        } else if (data.display_name) {
          const segments = data.display_name.split(',');
          const shortName = segments.slice(0, 2).join(',').trim();
          setSelectedSearchArea(shortName);
        }
      }
    } catch (e) {
      console.error('Reverse geocoding failed', e);
    } finally {
      setIsReverseGeocoding(false);
    }
  };

  // Resolve typed area text to lat/lng and fly map to it
  const geocodeAndGo = async (queryText: string, showNotification = true) => {
    if (!queryText || !queryText.trim()) return;
    setIsLocatingOnMap(true);
    try {
      const queryEgypt = queryText.includes('مصر') ? queryText : `${queryText}، مصر`;
      const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryEgypt)}&accept-language=ar`, {
        headers: {
          'User-Agent': 'SufanaAppletExplorer/1.0'
        }
      });
      if (resp.ok) {
        const results = await resp.json();
        if (results && results.length > 0) {
          const first = results[0];
          const lat = parseFloat(first.lat);
          const lng = parseFloat(first.lon);
          
          if (mapRef.current && (window as any).L) {
            const map = mapRef.current;
            map.flyTo([lat, lng], 13);
            
            if (markerRef.current) {
              markerRef.current.setLatLng([lat, lng]);
            }
            if (circleRef.current) {
              circleRef.current.setLatLng([lat, lng]);
            }
            if (showNotification) {
              alert(`تم تفقد المنطقة بالخريطة وتوجيه المؤشر نحو: \n"${first.display_name.split(',').slice(0,3).join(',')}"`);
            }
          }
        } else {
          if (showNotification) {
            alert('تعذر تحديد موقع هذه المنطقة أوتوماتيكياً على الخريطة. يرجى سحب المؤشر أو تكبير الخريطة يدوياً.');
          }
        }
      }
    } catch (e) {
      console.error(e);
      if (showNotification) {
        alert('حدث خطأ غير متوقع أثناء الاتصال بالخادم الجغرافي.');
      }
    } finally {
      setIsLocatingOnMap(false);
    }
  };

  // Dynamic circle radius mapping updates
  React.useEffect(() => {
    if (circleRef.current && mapRadius) {
      circleRef.current.setRadius(mapRadius);
    }
  }, [mapRadius]);

  // Handle leaflet map load dynamically when activeTab is maps_finder
  React.useEffect(() => {
    if (activeTab !== 'maps_finder') return;

    let isMounted = true;
    
    const initMap = async () => {
      // Append Leaflet assets
      if (!document.getElementById('leaflet-css-style-id')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css-style-id';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      if (!(window as any).L) {
        if (!document.getElementById('leaflet-js-script-id')) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script');
            script.id = 'leaflet-js-script-id'; // تأمين حقن الكود لمنع تسريب الذاكرة
            script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load Leaflet script'));
            document.body.appendChild(script);
          });
        }
      }

      if (!isMounted) return;
      const L = (window as any).L;
      if (!L) return;

      const container = document.getElementById('maps-leaflet-container');
      if (!container) return;

      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch (e) {
          console.error(e);
        }
        mapRef.current = null;
      }

      // Default coords El Zagazig
      const defLat = 30.587680;
      const defLng = 31.502000;

      const map = L.map('maps-leaflet-container', {
        center: [defLat, defLng],
        zoom: 12,
      });
      mapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      // SPA icon resolution fix for leaflet marker assets
      const DefaultIcon = L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
      });
      L.Marker.prototype.options.icon = DefaultIcon;

      const marker = L.marker([defLat, defLng], {
        draggable: true
      }).addTo(map);
      markerRef.current = marker;

      const circle = L.circle([defLat, defLng], {
        radius: mapRadius,
        color: '#E11D48', // beautiful rose-600
        fillColor: '#FDA4AF', // beautiful rose-300
        fillOpacity: 0.18,
        weight: 2
      }).addTo(map);
      circleRef.current = circle;

      marker.on('move', () => {
        const latlng = marker.getLatLng();
        circle.setLatLng(latlng);
      });

      marker.on('dragend', async () => {
        const latlng = marker.getLatLng();
        circle.setLatLng(latlng);
        await triggerReverseGeocode(latlng.lat, latlng.lng);
      });

      // Zoom to existing area if pre-selected
      if (selectedSearchArea.trim()) {
        setTimeout(() => {
          if (isMounted) geocodeAndGo(selectedSearchArea.trim(), false);
        }, 550);
      } else {
        await triggerReverseGeocode(defLat, defLng);
      }
    };

    initMap().catch(err => console.error(err));

    return () => {
      isMounted = false;
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch (e) {
          console.error(e);
        }
        mapRef.current = null;
      }
    };
  }, [activeTab]);
  
  // Slicing/segmenting capabilities for large maps list
  const [batchSize, setBatchSize] = useState<number>(10);
  const [activePitchLeadId, setActivePitchLeadId] = useState<string | null>(null);
  const [aiPitchText, setAiPitchText] = useState<string>('');

  // Toggling expanded/collapsed states for different lists
  const [expandedRealCustomers, setExpandedRealCustomers] = useState<Record<string, boolean>>({});
  const [expandedGoogleLeads, setExpandedGoogleLeads] = useState<Record<string, boolean>>({});
  const [expandedStagedLeads, setExpandedStagedLeads] = useState<Record<string, boolean>>({});

  // Advanced AI Advisor Database & Copywriters
  const getAIAdviceForStore = (type: string) => {
    const t = type || '';
    if (t.includes('هايبر ماركت') || t.includes('سوبر ماركت كبير')) {
      return {
        ratingLabel: 'هايبر ماركت وسوبر ماركت كبير',
        bestPractice: 'الهايبر ماركت يتميز بحجم مسحوبات ضخم جداً ونقاط ترويج قوية. ركز على تقديم عروض أسعار الكرتونة والجملة الحصرية مع تسهيلات سداد وعرض ترويجي بارز وستاند عرض خاص بمنتجات سوفانا مجاناً لزيادة التفاعل اليومي ورؤية المنتج.',
        steps: [
          'الاتفاق مع الإدارة على وضع ستاند عرض خشبي مخصص لمنتجات سوفانا مجاناً.',
          'توفير كوبونات خصم أو ميزات هدايا نقدية فورية لإدارة السوبر ماركت عند تحقيق تارجت شهري.',
          'تأمين خط إمداد دوري ثابت مع المندوب وضمان عدم انقطاع أي وزن من الزيوت والسمن.'
        ]
      };
    } else if (t.includes('مخبز') || t.includes('أفران') || t.includes('فرن')) {
      return {
        ratingLabel: 'مخبز وبلدي وأفران معجنات',
        bestPractice: 'الأفران والمخابز تستهلك كميات وفيرة من السمن الصناعي والزبدة وزيوت العجن لدعم جودة العجين. اعرض عليهم صفائح زيت وسمن سوفانا بأوزانها وسعر الجملة للمخابز مع التركيز على نعومة الملمس والتوراق وجودة رائحة المخبوزات والكرواسون.',
        steps: [
          'تقديم عينة للخباز لتجربتها بنفسه في عجن الفينو أو معجنات السكر لرؤية التوراق والمعان بنفسه.',
          'عرض ميزة الدفع بعد تسليم الوجبة الأولى وتسهيل الدفع كدعم لفرن المعجنات.',
          'تسجيل موعد زيارة أسبوعي منتظم من المندوب لتوريد الصفائح والكراتين في أوقات الصباح الباكر.'
        ]
      };
    } else if (t.includes('سوبر ماركت') || t.includes('هايبر')) {
      return {
        ratingLabel: 'هايبر / سوبر ماركت نشط',
        bestPractice: 'الاعتماد على عينات مجانية صغيرة الحجم لعرض جودة المنتج لربات البيوت. قدم له ميزة الدفع الآجل الجزئي بعد سحب الدفعة الأولى. ركز على أن زيت وسمن سوفانا يحقق هامش ربح أعلى 15% مقارنة بالمنتجات المنافسة مع جودة تضاهي الشركات الكبرى.',
        steps: [
          'تزويده بستائر دعائية لرفوف السوبر ماركت مجاناً لزيادة جاذبية الصنف.',
          'ترتيب البضاعة في مستوى نظر المستهلك الفعلي بالاتفاق معه لزيادة المبيعات.',
          'تقديم خصم تصاعدي فوري مع زيادة عدد الكراتين المسحوبة شهرياً لضمان الولاء.'
        ]
      };
    } else if (t.includes('بقالة') || t.includes('مواد غذائية')) {
      return {
        ratingLabel: 'بقال تجزئة نشط',
        bestPractice: 'البقال يركز بشدة على استمرارية التوريد والأسعار المنافسة بسبب حساسية فئته السعرية. وفر له خدمة التوصيل السريع للمكان وسهّل عملية الارتجاع للعبوات التالفة لإزالة أي مخاوف لديه.',
        steps: [
          'تقديم تسهيل بسيط في كمية الحد الأدنى للطلب (بدءاً من كرتونة واحدة فقط).',
          'وفّر له بوسترات صغيرة ملونة لتعليقها على واجهة المحل لتعريف المترددين.',
          'قم بزيارته دورياً في نفس اليوم من كل أسبوع لكسب ثقته وتثبيت موعد سحب مرتجع الكرتون.'
        ]
      };
    } else if (t.includes('مطعم')) {
      return {
        ratingLabel: 'مورد مطاعم ومآكل',
        bestPractice: 'المطاعم تستهلك كميات ضخمة من الزيوت والسمن ويبحثون بالدرجة الأولى عن نقطة الدخان المرتفعة ومقاومة الزرنخة وقدرة التحمل بالتسخين المديد. ركز أثناء حديثك على نقاء زيوت سوفانا وسعة توفيرها في القلي المتكرر دون تغير الطعم.',
        steps: [
          'تقديم عينة مجانية عبوة 1 لتر أو 5 لتر للتجربة العملية داخل المطبخ مباشرة.',
          'توفير عقود إمداد تكرارية ثابتة بأسعار كسر الجملة لدعم ربحيته وتشجيعه على الطلب.',
          'الحفاظ على سرعة ودقة الاستجابة لأي نقص طارئ كحل منقذ لمطبخه لمواصلة القلي والطهي.'
        ]
      };
    } else { // Perfumer / Spice Shop 'عطارة'
      return {
        ratingLabel: 'عطار / عطارة وبقالة جملة',
        bestPractice: 'يحب العطار المعاملة العائلية وبناء الثقة الشخصية، ويركز على جودة الرائحة والنكهة في السمن والزيوت السائبة والمعبأة. اعرض عليه شهادات جودة طعم وجدار المنتج ونقاوة مصفاه الطبيعي.',
        steps: [
          'تقديم خصم جملة الجملة التشجيعي عند طلب كميات تتجاوز 10 كرتونة فما فوق.',
          'تقديم عينة عرض مفتوحة برائحة السمن الطبيعي المذهلة لجذب المتسوقين وتنمية رغبتهم.',
          'إدراج عطارته المرموقة في قائمة الموزعين عبر إعلانات الصفحة لمنطقتك مجاناً لتسريع مبيعاته.'
        ]
      };
    }
  };

  const generateAIPitchMessage = (type: string, clientName: string) => {
    const t = type || '';
    const guidelines = settings.aiPitchGuidelines ? `\n\n(🎯 تذكير بالنقاط الرئيسية المتفق عليها بالعرض: ${settings.aiPitchGuidelines})` : '';
    
    if (t.includes('هايبر ماركت') || t.includes('سوبر ماركت كبير')) {
      return `السلام عليكم يا فندم، معكم مندوب زيوت وسمن سوفانا الفاخرة 🌸. يسعدنا التعاون معكم وتقديم عروض سمن وزيوت حصرية لـ [ ${clientName} ] بمميزات مخصصة للهايبر ماركت وسحب كميات ومستويات توريد مستمرة. نضمن لكم هامش ربح ممتاز وتجربة عينات مجانية لعملائكم.${guidelines}\n\nهل نتشرف بتحديد موعد للزيارة؟`;
    } else if (t.includes('مخبز') || t.includes('أفران') || t.includes('فرن')) {
      return `السلام عليكم ورحمة الله، معكم مندوب زيوت وسمن سوفانا الخاصة بالمخابز والأفران 🥖. يشرفنا تزويد [ ${clientName} ] بأجود أنواع سمن العجن والزيوت النباتية المصفاة المخصصة للحلويات والفينو والمعجنات، بأسعار جملة تشجيعية وتسهيل دفع ممتاز لضمان جودة طعم ورائحة لا تقاوم لمخبوزاتكم.${guidelines}\n\nيسعدنا إرسال عينة تجريبية للمصانع والأفران اليوم للتجربة الفوقية؟`;
    } else if (t.includes('سوبر ماركت') || t.includes('هايبر')) {
      return `السلام عليكم يا فندم، معكم مندوب زيوت وسمن سوفانا الفاخرة 🌸. يسعدنا التعاون معكم وتقديم عرض توريد خاص جداً يناسب السوبر ماركت المميز لديكم [ ${clientName} ] بمستويات طلب مرنة وهوامش ربح ممتازة لعملائكم، مع توفير عينات تذوق مجاناً لزيادة حركة سحب الصنف بالرفوف.${guidelines}\n\nهل يمكننا تحديد موعد لزيارتكم وتقديم قائمة الأسعار والخصومات الحصرية؟`;
    } else if (t.includes('بقالة') || t.includes('مواد غذائية')) {
      return `أهلاً بحضرتك يا فندم، معكم زيوت وسمن سوفانا 🌟. يسعدنا نوفر لكم خدمة توصيل سريعة ومجانية لبقالتكم الكريمة [ ${clientName} ] مع هامش ربح تنافسي يزيد مبيعاتكم، وضمان الاسترجاع الكامل والاستبدال الفوري للأصناف. أسعارنا تبدأ من كرتونة واحدة وتسهيلات دفع تشجيعية.${guidelines}\n\nيشرفنا نرسل لحضرتك كتالوج الأصناف المتاحة للطلب الفوري؟`;
    } else if (t.includes('مطعم')) {
      return `السلام عليكم يا فندم، معكم شريككم في الجودة؛ زيوت وسمن سوفانا الممتازة للمطاعم الفاخرة [ ${clientName} ] 🍳. ندرك أهمية نقاوة الزيت ومقاومته للحرارة العالية لتقديم طعام صحي وشهي؛ لذلك صممنا عروض الجملة الخاصة بمطاعم الفول والفلافل والمأكولات الشعبية بنسب توفير مذهلة وبند سحب دوري سهل.${guidelines}\n\nيسعدنا إرسال عينة تذوق وتجريب مجانية للمطبخ اليوم للتأكد من جدارتنا بالاعتماد؟`;
    } else {
      return `مرحباً بحضرتك يا فندم، معكم زيوت وسمن سوفانا 🌿. نتشرف بالتعاون مع تجار العطارة الكرام في [ ${clientName} ]، ونوفر لكم سمن بلدي وزيوت طبيعية بنكهات أصلية وروائح جذابة تضمن ولاء المتسوقين وبخصومات مخصصة للكميات تبدأ من 5 كراتين مع ترويج مجاني لعطارتكم في منصاتنا لضمان بيع ممتاز.${guidelines}\n\nهل تود التعرف على أسعار التوريد والكميات المتاحة حالياً؟`;
    }
  };

  // Lead finder mock generator with rating & review count and pagination/slicing
  const handleStartMapsSearch = async () => {
    const finalArea = selectedSearchArea.trim();
    if (!finalArea) {
      alert('الرجاء كتابة اسم المدينة أو المنطقة المجرى استكشافها بالخرائط.');
      return;
    }

    setIsSearchingMaps(true);
    setMapsResults([]);

    try {
      const userMessage = `أريد البحث بدقة عن المحلات والأنشطة التجارية في منطقة/مدينة: "${finalArea}".
النشاط المطلوب: "${storeType}".
العدد المطلوب سحبه: ${batchSize}.

يرجى إرجاع النتيجة بصيغة JSON فقط تحتوي على:
1. مصفوفة "leads" تضم المحلات (يجب أن تحاول استرجاع أسماء محلات واقعية موجودة في تلك المنطقة من معرفتك). لكل محل:
   - "id": نص فريد.
   - "name": اسم المحل/النشاط.
   - "phone": رقم هاتف مصري عشوائي ولكن بصيغة واقعية لتلك المنطقة (مثل 010 أو 011 ...).
   - "area": نفس اسم المنطقة المحددة.
   - "detailedAddress": عنوان دقيق للفرع داخل هذه المنطقة (شارع أو معلم معروف).
   - "rating": تقييم عشوائي (من 3.5 إلى 5.0).
   - "reviewsCount": عدد تقييمات.
   - "locationLink": يمكن تركه فارغاً.
   - "type": "${storeType}"
2. نص "search_note": اشرح فيه بدقة سبب جلبك لهذا العدد. إذا طلبت 30 ولم تجد إلا 15، اخبرني أن هذه هي المحلات المتاحة والمشهورة في المنطقة وتتطابق مع الوصف، وأن الباقي لم يظهر لعدم توفر بيانات مؤكدة له بالنطاق أو لاختلاف الفئة.

أرسل JSON فقط بدون أي علامات ماركداون وبدون كلام إضافي.`;

      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: 'أنت مساعد جغرافي دقيق يعيد بيانات بصيغة JSON فقط. ولا تستخدم كود بلوكس `json`.',
          history: [],
          message: userMessage
        })
      });

      if (!response.ok) {
        throw new Error('فشل جلب البيانات من الخادم.');
      }

      const rawData = await response.json();
      let text = rawData.text;
      
      text = text.replace(/```json/g, '').replace(/```/g, '').trim();

      const parsedJSON = JSON.parse(text);
      if (parsedJSON.leads && Array.isArray(parsedJSON.leads)) {
        const newResults = parsedJSON.leads.map((item: any, index: number) => ({
          ...item,
          id: item.id || `lead-${Date.now()}-${index}`,
          locationLink: item.locationLink || `https://maps.google.com/?q=${encodeURIComponent(item.name + ' ' + (item.detailedAddress || finalArea))}`
        }));
        
        setMapsResults(newResults);
        
        if (parsedJSON.search_note) {
          alert('ملاحظة البحث: ' + parsedJSON.search_note);
        }
      } else {
        throw new Error('التنسيق غير مطابق.');
      }
    } catch (e: any) {
      console.error(e);
      alert('حدث خطأ أثناء الاتصال بالخادم الذكي لاستخراج العملاء. ' + e.message);
    } finally {
      setIsSearchingMaps(false);
    }
  };

  const handleAddMapLeadToGoogleLeads = (lead: any) => {
    // Add to googleLeads watchlist if not exists
    const exists = googleLeads.some(g => g.phone === lead.phone || g.name.toLowerCase() === lead.name.toLowerCase());
    if (exists) {
      alert('تم إضافة هذا المحل بالفعل في قائمة عملاء جوجل للمتابعة.');
      setAddedLeadIds(prev => [...prev, lead.id]);
      return;
    }

    const updated = [...googleLeads, { ...lead, dateAdded: new Date().toLocaleDateString('ar-EG'), confirmed: false }];
    setGoogleLeads(updated);
    setAddedLeadIds(prev => [...prev, lead.id]);
  };

  const handleConfirmGoogleLead = (lead: any) => {
    const finalArea = (lead.detailedAddress || lead.area || 'أخرى').trim();
    
    // Auto add immediately using onAddCustomer callback prop
    onAddCustomer({
      name: (lead.name || '').trim(),
      phone: (lead.phone || '').trim(),
      area: finalArea,
      locationLink: lead.locationLink || `https://maps.google.com/?q=${encodeURIComponent((lead.name || '').trim() + ' ' + finalArea)}`
    });

    // Mark as confirmed in staging
    setGoogleLeads(prev => prev.map(g => g.id === lead.id ? { ...g, confirmed: true } : g));
    alert(`تم تأكيد العميل "${lead.name}" وإضافته بنجاح لقائمة عملائك الفعليين في منطقة [ ${finalArea} ]! 🎉`);
  };

  const handleDeleteGoogleLead = (leadId: string) => {
    setGoogleLeads(prev => prev.filter(g => g.id !== leadId));
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const finalArea = area === 'أخرى' ? customArea.trim() : area.trim();
    if (!finalArea) {
      alert('يرجى تحديد أو كتابة المنطقة السكنية.');
      return;
    }

    if (editingCustomer) {
      onEditCustomer({
        ...editingCustomer,
        name: name.trim(),
        phone: phone.trim(),
        area: finalArea,
        locationLink: locationLink.trim() || `https://maps.google.com/?q=${encodeURIComponent(name.trim() + ' ' + finalArea)}`
      });
      alert('تم تعديل بيانات العميل بنجاح.');
    } else {
      onAddCustomer({
        name: name.trim(),
        phone: phone.trim(),
        area: finalArea,
        locationLink: locationLink.trim() || `https://maps.google.com/?q=${encodeURIComponent(name.trim() + ' ' + finalArea)}`
      });
    }

    setName('');
    setPhone('');
    setArea('');
    setCustomArea('');
    setLocationLink('');
    setGeoStatusMsg('');
    setShowAddForm(false);
    setEditingCustomer(null);
  };

  // Capture Geolocation coords and turn them into a google maps link automatically!
  const handleLoadCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGeoStatusMsg('متصفحك لا يدعم تحديد الموقع المستقل.');
      return;
    }

    setLoadingGeo(true);
    setGeoStatusMsg('جاري الحصول على إحداثيات GPS...');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const link = `https://www.google.com/maps?q=${latitude},${longitude}`;
        setLocationLink(link);
        setGeoStatusMsg('تم جلب موقعك بنجاح ونقله لرابط الخرائط!');
        setLoadingGeo(false);
      },
      (error) => {
        setLoadingGeo(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setGeoStatusMsg('تم رفض طلب تحديد الموقع من فضلك اسمح بالوصول في متصفحك.');
            break;
          case error.POSITION_UNAVAILABLE:
            setGeoStatusMsg('موقع الـ GPS غير متاح حالياً.');
            break;
          case error.TIMEOUT:
            setGeoStatusMsg('انتهت مهلة جلب الموقع من القمر الصناعي.');
            break;
          default:
            setGeoStatusMsg('حدث خطأ غير متوقع أثناء تحديد الموقع.');
        }
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Filtering
  const filteredCustomers = customers.filter(c => {
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      c.area.toLowerCase().includes(q)
    );
  });

  return (
    <div className="bg-[#F7FAFC] min-h-screen pb-12" id="customers-tab-container">
      {/* Header */}
      <div className="bg-[#1A365D] text-white border-transparent text-white px-4 py-4 sticky top-0 z-10 shadow-md flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-6 w-6 text-indigo-200" />
          <h1 className="text-xl font-bold">قاعدة بيانات العملاء</h1>
        </div>
        <button
          onClick={onGoBack}
          className="bg-[#FFFFFF]/10 hover:bg-[#FFFFFF]/20 active:scale-95 text-white rounded-lg py-1.5 px-3.5 text-sm font-semibold transition-all flex items-center gap-1 cursor-pointer"
        >
          <span>الرئيسية</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      <div className="max-w-xl mx-auto p-4 flex flex-col gap-5">
        
        {/* Sub-tab switcher */}
        {(() => {
          const showList = !permittedSubTabs || permittedSubTabs.length === 0 || permittedSubTabs.includes('customers_list');
          const showMaps = !permittedSubTabs || permittedSubTabs.length === 0 || permittedSubTabs.includes('customers_maps_finder');
          return (
            <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-inner gap-1" id="customers-subtabs">
              {showList && (
                <button
                  type="button"
                  onClick={() => setActiveTab('list')}
                  className={`flex-1 text-center py-2.5 text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 rounded-xl ${
                    activeTab === 'list' ? 'bg-[#FFFFFF] text-[#DD6B20] shadow-xs border border-slate-200' : 'text-[#6B7280] bg-transparent hover:text-[#1A365D]'
                  }`}
                >
                  <Users className="h-3.5 w-3.5 font-bold" />
                  <span>العملاء ({customers.length})</span>
                </button>
              )}
              
              {showMaps && (
                <>
                  <button
                    type="button"
                    onClick={() => setActiveTab('maps_finder')}
                    className={`flex-1 text-center py-2.5 text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 rounded-xl ${
                      activeTab === 'maps_finder' ? 'bg-[#FFFFFF] text-[#DD6B20] shadow-xs border border-slate-200' : 'text-[#6B7280] bg-transparent hover:text-[#1A365D]'
                    }`}
                  >
                    <Compass className="h-3.5 w-3.5" />
                    <span>استكشاف عملاء</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('google_leads')}
                    className={`flex-1 text-center py-2.5 text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 rounded-xl ${
                      activeTab === 'google_leads' ? 'bg-[#FFFFFF] text-[#DD6B20] shadow-xs border border-slate-200' : 'text-[#6B7280] bg-transparent hover:text-[#1A365D]'
                    }`}
                  >
                    <span className="relative flex h-2 w-2">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 ${googleLeads.filter(g => !g.confirmed).length === 0 ? 'hidden' : ''}`}></span>
                      <span className={`relative inline-flex rounded-full h-2 w-2 bg-red-500 ${googleLeads.filter(g => !g.confirmed).length === 0 ? 'hidden' : ''}`}></span>
                    </span>
                    <span>عملاء محتملين ({googleLeads.length})</span>
                  </button>
                </>
              )}
            </div>
          );
        })()}

        {/* 1. Current Customer List Tab */}
        {activeTab === 'list' && (
          <div className="flex flex-col gap-5 animate-fade-in">
            {/* Registration Form */}
            {!showAddForm ? (
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(true);
                  setArea('');
                  setCustomArea('');
                }}
                className="w-full bg-[#1A365D] text-white border-transparent hover:bg-[#1A365D] text-white border-transparent active:scale-95 text-white font-bold py-3.5 px-5 rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
              >
                <Plus className="h-5 w-5 text-emerald-300" />
                <span>إضافة عميل جديد لقسم التوزيع</span>
              </button>
            ) : (
              <form onSubmit={handleAddSubmit} className="bg-sky-50 p-5 rounded-2xl border border-sky-100 shadow-sm flex flex-col gap-4">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <h3 className="font-bold text-[#1A365D] text-base flex items-center gap-1.5">
                    <Plus className="h-5 w-5 text-[#2B6CB0]" />
                    إضافة عميل جديد لقسم التوزيع
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="text-gray-400 hover:text-[#2B6CB0] text-xs font-bold bg-[#F7FAFC] p-1 px-2.5 rounded-lg transition-colors cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="inline-block bg-indigo-100 text-indigo-950 border border-indigo-200 text-xs font-black px-2.5 py-1 rounded-md mb-2 shadow-sm">اسم العميل</label>
                    <input
                      type="text"
                      required
                      placeholder="مثال: سوبرماركت الهدى"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-[#F7FAFC] border border-slate-200 rounded-lg p-2.5 text-sm font-semibold focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="inline-block bg-sky-100 text-sky-950 border border-sky-200 text-xs font-black px-2.5 py-1 rounded-md mb-2 shadow-sm">الهاتف</label>
                      <input
                        type="tel"
                        required
                        placeholder="مثال: 01011223344"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full bg-[#F7FAFC] border border-slate-200 rounded-lg p-2.5 text-sm font-semibold focus:ring-2 focus:ring-indigo-500 text-center"
                      />
                    </div>
                    <div>
                      <label className="inline-block bg-amber-100 text-amber-950 border border-amber-200 text-xs font-black px-2.5 py-1 rounded-md mb-2 shadow-sm">المنطقة</label>
                      <select
                        required
                        value={area}
                        onChange={(e) => {
                          const val = e.target.value;
                          setArea(val);
                          if (val !== 'أخرى') {
                            setCustomArea('');
                          }
                        }}
                        className="w-full bg-[#F7FAFC] border border-slate-200 rounded-lg p-2.5 text-xs font-bold focus:ring-2 focus:ring-indigo-500 text-right text-[#1A365D]"
                      >
                        <option value="">اختر المنطقة...</option>
                        {allAreas.map(a => (
                          <option key={a} value={a}>{a}</option>
                        ))}
                        <option value="أخرى">منطقة أخرى (كتابة يدوية)...</option>
                      </select>
                      {area === 'أخرى' && (
                        <input
                          type="text"
                          required
                          placeholder="اكتب اسم المنطقة هنا..."
                          value={customArea}
                          onChange={(e) => setCustomArea(e.target.value)}
                          className="w-full bg-[#F7FAFC] border border-indigo-300 rounded-lg p-2 text-xs font-bold focus:ring-2 focus:ring-indigo-550 text-center mt-1.5"
                        />
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1.5 flex-wrap gap-1">
                      <label className="inline-block bg-indigo-100 text-indigo-950 border border-indigo-200 text-xs font-black px-2.5 py-1 rounded-md shadow-sm">رابط الخرائط</label>
                      <button
                        type="button"
                        onClick={handleLoadCurrentLocation}
                        disabled={loadingGeo}
                        className="text-xs font-bold text-[#1A365D] bg-indigo-50 hover:bg-indigo-100 py-1 px-2.5 rounded-lg border border-indigo-200 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <MapPin className="h-3.5 w-3.5" />
                        <span>{loadingGeo ? 'تحديد إحداثيات...' : 'تحديد بموقعي الحالي'}</span>
                      </button>
                    </div>
                    <input
                      type="url"
                      placeholder="مثال: https://maps.google.com/?q=..."
                      value={locationLink}
                      onChange={(e) => setLocationLink(e.target.value)}
                      className="w-full bg-[#F7FAFC] border border-slate-200 rounded-lg p-2.5 text-xs text-left font-mono focus:ring-2 focus:ring-indigo-500"
                    />
                    {geoStatusMsg && (
                      <p className="text-[10.5px] font-bold text-[#1A365D] bg-indigo-50/50 p-2 rounded-lg mt-1 border border-indigo-100">
                        {geoStatusMsg}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-[#1A365D] text-white border-transparent text-white rounded-xl py-3 text-sm font-bold active:scale-95 transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer hover:bg-[#1A365D] text-white border-transparent mt-1"
                >
                  <span>{editingCustomer ? 'حفظ تعديلات العميل' : 'حفظ العميل الجديد'}</span>
                </button>
              </form>
            )}

            {/* Search & List */}
            <div className="bg-sky-50 p-5 rounded-2xl border border-sky-100 shadow-sm flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center border-b border-sky-200 pb-3">
                <h3 className="font-bold text-[#1A365D] text-base">دليل العملاء ({customers.length})</h3>
                <div className="relative w-full sm:w-56 leading-none">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-sky-400" />
                  <input
                    type="text"
                    placeholder="بحث..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#F7FAFC] pr-9 pl-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

               <div className="flex flex-col gap-3.5">
                {filteredCustomers.length === 0 ? (
                  <p className="text-center text-gray-400 py-8 text-sm">لا توجد نتائج بحث مطابقة.</p>
                ) : (
                  filteredCustomers.map(customer => {
                    const isExpanded = !!expandedRealCustomers[customer.id];
                    return (
                      <div key={customer.id} className="border border-slate-150 rounded-xl overflow-hidden bg-[#FFFFFF] shadow-xs hover:border-indigo-200 transition-all flex flex-col">
                        {/* Header (Clickable to expand/collapse) */}
                        <div
                          onClick={() => setExpandedRealCustomers(prev => prev[customer.id] ? {} : { [customer.id]: true })}
                          className="p-4 bg-[#F7FAFC]/60 hover:bg-[#F7FAFC] flex items-center justify-between gap-4 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-2 text-sm select-none">
                            <span className={`h-2.5 w-2.5 rounded-full shrink-0 transition-colors ${isExpanded ? 'bg-[#FFFFFF] text-[#1A365D] border-b-2 border-[#DD6B20] shadow-sm' : 'bg-slate-350'}`}></span>
                            <span className="font-extrabold text-[#1A365D] text-sm sm:text-base">{customer.name}</span>
                            <span className="text-[10.5px] bg-slate-200/85 text-[#1A365D] font-extrabold px-2 py-0.5 rounded-md">
                              {customer.area}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 text-xs font-bold text-[#2B6CB0]">
                            <span>{isExpanded ? 'إخفاء التفاصيل ▲' : 'عرض التفاصيل ▼'}</span>
                          </div>
                        </div>

                        {/* Collapsible Details Body */}
                        {isExpanded && (
                          <div className="p-4 border-t border-slate-100 bg-[#FFFFFF] flex flex-col gap-4 animate-fade-in">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs text-[#1A365D]">
                              <div className="flex items-center gap-2 font-semibold">
                                <Phone className="h-4 w-4 text-[#1A365D] shrink-0" />
                                <span>رقم الهاتف:</span>
                                <SecurePhoneDisplay phone={customer.phone} enableWhatsApp={true} />
                              </div>
                              <div className="flex items-center gap-2 font-semibold">
                                <MapPin className="h-4 w-4 text-emerald-500 shrink-0" />
                                <span>المنطقة الجغرافية:</span>
                                <span className="font-extrabold text-slate-850">{customer.area}</span>
                              </div>
                            </div>

                            {/* Actions bar: call, whatsapp, location, delete */}
                            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 mt-1">
                              {/* Direct Calling & Messaging */}
                              <div className="flex items-center gap-2 w-full sm:w-auto">
                                <a
                                  href={`tel:${customer.phone}`}
                                  className="flex-1 sm:flex-none px-3 py-1.5 bg-[#F7FAFC] hover:bg-blue-100/85 text-blue-700 border border-blue-200 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-all active:scale-95 text-center"
                                  title="اتصال مباشر بالهاتف"
                                >
                                  <Phone className="h-3.5 w-3.5" />
                                  <span>اتصال هاتفي</span>
                                </a>

                                <a
                                  href={`https://wa.me/20${customer.phone.replace(/^0/, '')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex-1 sm:flex-none px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100/85 text-[#DD6B20] border border-emerald-200 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-all active:scale-95 text-center"
                                  title="مراسلة سريعة على الواتساب"
                                >
                                  <MessageSquare className="h-3.5 w-3.5" />
                                  <span>واتساب مباشر</span>
                                </a>
                                
                                <button
                                  onClick={() => handleGenerateAndSendWA(customer)}
                                  disabled={waLoadingId === customer.id}
                                  className="flex-1 sm:flex-none px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100/85 text-[#1A365D] border border-indigo-200 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-all active:scale-95 text-center disabled:bg-[#F7FAFC] disabled:text-gray-400"
                                  title="صياغة وإرسال رسالة ذكية"
                                >
                                  <Sparkles className="h-3.5 w-3.5" />
                                  <span>{waLoadingId === customer.id ? 'جاري..' : 'رسالة ذكية'}</span>
                                </button>
                              </div>

                              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                                {customer.locationLink && (
                                  <a
                                    href={customer.locationLink}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-[#DD6B20] border border-emerald-100 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                                    title="الموقع على خرائط جوجل"
                                  >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                    <span>عرض بالخريطة</span>
                                  </a>
                                )}
                                <button
                                  onClick={() => {
                                    setEditingCustomer(customer);
                                    setName(customer.name);
                                    setPhone(customer.phone);
                                    const areaExists = allAreas.includes(customer.area);
                                    if (areaExists) {
                                      setArea(customer.area);
                                      setCustomArea('');
                                    } else {
                                      setArea('أخرى');
                                      setCustomArea(customer.area);
                                    }
                                    setLocationLink(customer.locationLink || '');
                                    setShowAddForm(true);
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                  }}
                                  className="p-1.5 px-3 text-[#2B6CB0] hover:bg-indigo-50 border border-transparent hover:border-indigo-100 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                                  title="تعديل العميل"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                  </svg>
                                  <span>تعديل</span>
                                </button>
                                <button
                                  onClick={async () => {
                                    if (await confirmDialog(`هل أنت متأكد من حذف العميل [${customer.name}]؟`)) {
                                      onDeleteCustomer(customer.id);
                                    }
                                  }}
                                  className="p-1.5 px-3 text-rose-500 hover:bg-rose-50 border border-transparent hover:border-rose-100 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                                  title="حذف العميل"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  <span>حذف</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* 2. Google Maps Customer Lead Finder */}
        {activeTab === 'maps_finder' && (
          <div className="flex flex-col gap-4 animate-fade-in" id="google-maps-finder">
            
            {/* Search inputs */}
            <div className="bg-[#FFFFFF] p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4">
              <div className="border-b border-slate-100 pb-2 flex items-center gap-2">
                <Compass className="h-5 w-5 text-[#1A365D] animate-spin-slow" />
                <h3 className="font-bold text-slate-850 text-base">منقّب عملاء ومحلات Google Maps</h3>
              </div>

              <div className="grid grid-cols-1 gap-3.5">
                {/* Search Area */}
                <div>
                  <div className="flex justify-between items-center mb-1 bg-indigo-50/50 p-1.5 rounded-lg border border-indigo-100">
                    <label className="text-indigo-950 text-xs font-black">المدينة أو المنطقة المستهدفة</label>
                    <button
                      type="button"
                      disabled={isLocatingOnMap}
                      onClick={() => geocodeAndGo(selectedSearchArea)}
                      className="text-[10px] font-extrabold bg-[#1A365D] hover:bg-[#2B6CB0] text-white px-2.5 py-1 rounded shadow-sm flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      {isLocatingOnMap ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin text-white" />
                          <span>جاري البحث...</span>
                        </>
                      ) : (
                        <>
                          <MapPin className="h-3 w-3 text-emerald-400 animate-bounce" />
                          <span>تحديد وتكبير الخريطة بالاسم 🧭</span>
                        </>
                      )}
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="اكتب اسم المدينة أو المنطقة المجرى استكشافها هنا (مثال: الزقازيق، ميت غمر، بدر)..."
                    value={selectedSearchArea}
                    onChange={(e) => setSelectedSearchArea(e.target.value)}
                    className="w-full bg-[#F7FAFC] border border-slate-200 rounded-lg p-2.5 text-xs font-bold focus:ring-2 focus:ring-indigo-500 text-right text-[#1A365D]"
                  />
                  
                  {/* Interactive Leaflet Map Visual Interface */}
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
                    
                    {/* The Leaflet HTML Container */}
                    <div 
                      id="maps-leaflet-container" 
                      className="h-64 w-full relative z-0 bg-[#E0E2E7]"
                      style={{ minHeight: '260px' }}
                    ></div>

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

                      <p className="text-[10px] text-gray-500 font-extrabold leading-relaxed text-right bg-indigo-50/40 p-1.5 rounded border border-indigo-100/30">
                        💡 يمكنك سحب الدبوس الأزرق بالخريطة لتحديد شارع أو قرية معينة، وسيكتشف النظام العنوان الحركي تلقائياً، أو اكتب اسم المدينة وانقر زر التحديد بالاسم!
                      </p>
                    </div>
                  </div>
                </div>

                {/* Lead classification details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="inline-block bg-sky-100 text-sky-950 border border-sky-200 text-xs font-black px-2.5 py-1 rounded-md mb-2 shadow-sm">النشاط التجاري</label>
                     <select
                      value={storeType}
                      onChange={(e) => setStoreType(e.target.value)}
                      className="w-full bg-[#F7FAFC] border border-slate-200 rounded-lg p-2.5 text-xs font-bold focus:ring-2 focus:ring-indigo-500 text-[#1A365D] text-right"
                    >
                      <option value="الكل">الكل (جميع الأنشطة التجارية بالتوازي)</option>
                      <option value="الأعلى تقييماً">الأعلى تقييماً وتقديراً (فلترة بالتقييم 4.5+)</option>
                      <option value="هايبر ماركت وسوبر ماركت كبير">هايبر ماركت وسوبر ماركت كبير (مستهلك كميات لافت)</option>
                      <option value="سوبر ماركت ومينى ماركت">سوبر ماركت ومينى ماركت (مستهلك أساسي للزيوت وسمن)</option>
                      <option value="محل بقالة ومواد غذائية">محل بقالة تجزئة ومواد غذائية</option>
                      <option value="مطعم ومحل مأكولات وشعبية">مطعم مأكولات وفول وفلافل / حلواني (طلب كميات ومصانع)</option>
                      <option value="مخبز وبلدي وأفران معجنات">مخبز وبلدي وأفران معجنات (طلب كميات سمن بلدي وزبده)</option>
                      <option value="محل عطارة وبقالة جملة">محل عطارة ومواد تموينية جملة</option>
                    </select>
                  </div>

                  <div>
                    <label className="inline-block bg-emerald-100 text-emerald-950 border border-emerald-200 text-xs font-black px-2.5 py-1 rounded-md mb-2 shadow-sm">نطاق البحث</label>
                    <select
                      value={batchSize}
                      onChange={(e) => setBatchSize(Number(e.target.value))}
                      className="w-full bg-[#F7FAFC] border border-slate-200 rounded-lg p-2.5 text-xs font-bold focus:ring-2 focus:ring-indigo-500 text-[#1A365D] text-right"
                    >
                      <option value={10}>تجزئة سريعة (سحب 10 محلات بالموقع)</option>
                      <option value={20}>تجزئة متوسطة (سحب 20 محل لتغطية أوسع)</option>
                      <option value={30}>تغطية شاملة للمنطقة كاملة (سحب 30 عميل دفعة واحدة)</option>
                    </select>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleStartMapsSearch}
                disabled={isSearchingMaps}
                className="w-full bg-[#1A365D] text-white border-transparent hover:bg-[#1A365D] text-white border-transparent active:scale-95 text-white rounded-xl py-3.5 text-xs font-bold leading-none shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:bg-slate-300 disabled:cursor-not-allowed mt-2"
              >
                {isSearchingMaps ? (
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
            </div>

            {/* Radar Animation */}
            {isSearchingMaps && (
              <div className="bg-slate-900 border border-indigo-950 p-7 rounded-2xl flex flex-col items-center justify-center gap-4 text-center text-slate-300">
                <div className="relative w-20 h-20 rounded-full border border-indigo-500/30 flex items-center justify-center overflow-hidden bg-slate-950">
                  <div className="absolute inset-1 rounded-full border border-indigo-500/20"></div>
                  <div className="absolute inset-4 rounded-full border border-indigo-500/40"></div>
                  <div className="absolute w-2 h-2 bg-emerald-400 rounded-full animate-ping"></div>
                  <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-transparent to-indigo-500/20 rounded-full animate-spin"></div>
                  <MapPin className="h-6 w-6 text-emerald-400 absolute" />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-black text-slate-100">جاري قراءة الإحداثيات والخرائط المفترضة...</span>
                  <span className="text-[10px] text-gray-400 font-bold">يرجى الانتظار، السيرفر يبحث عن جهات اتصال نشطة لتناسب منتجاتك.</span>
                </div>
              </div>
            )}

            {!isSearchingMaps && mapsResults.length > 0 && (
              <div className="bg-[#FFFFFF] p-5 rounded-2xl border border-amber-100 shadow-sm flex flex-col gap-4 animate-fade-in">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <div className="flex flex-col">
                    <h4 className="font-bold text-[#1A365D] text-sm">المحلات والعملاء المكتشفين ({mapsResults.length})</h4>
                    <p className="text-[10.5px] text-slate-450 font-bold mt-0.5">سجل المحل بمسودة "عملاء جوجل" لمتابعته والاتصال به.</p>
                  </div>
                  <span className="text-[10px] bg-emerald-50 text-[#DD6B20] font-extrabold px-2 py-0.5 rounded border border-emerald-150">
                    نشط بخرائط جوجل
                  </span>
                </div>

                <div className="flex flex-col gap-5">
                  {mapsResults.map((lead) => {
                    const isAdded = googleLeads.some(g => g.name.toLowerCase() === lead.name.toLowerCase() || g.phone === lead.phone || addedLeadIds.includes(lead.id));
                    const isLeadExpanded = !!expandedGoogleLeads[lead.id];

                    return (
                      <div key={lead.id} className="border border-slate-150 rounded-xl overflow-hidden bg-[#FFFFFF] hover:border-indigo-200 transition-all flex flex-col shadow-sm">
                        
                        {/* Interactive Header for Toggle */}
                        <div 
                          onClick={() => setExpandedGoogleLeads(prev => ({ ...prev, [lead.id]: !prev[lead.id] }))}
                          className="p-4 bg-[#F7FAFC]/60 hover:bg-[#F7FAFC] flex items-center justify-between gap-4 cursor-pointer transition-colors"
                        >
                          <div className="flex flex-col gap-1.5 text-sm select-none">
                            <span className="font-extrabold text-slate-850 text-base flex items-center gap-1.5 leading-snug">
                              <span className={`h-2.5 w-2.5 rounded-full shrink-0 transition-all ${isLeadExpanded ? 'bg-[#FFFFFF] text-[#1A365D] border-b-2 border-[#DD6B20] shadow-sm' : 'bg-slate-350'}`}></span>
                              {lead.name}
                            </span>
                            <div className="flex flex-wrap gap-1.5 mt-0.5">
                              <span className="text-[10px] text-[#1A365D] font-extrabold bg-indigo-50/70 py-0.5 px-2 rounded border border-indigo-100 self-start">
                                تصنيف: {lead.type}
                              </span>
                              <div className="flex items-center gap-1 text-[10.5px] text-amber-600 font-black bg-amber-50 py-0.5 px-2 rounded-lg border border-amber-200/60 leading-none">
                                <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                                <span>{lead.rating || '4.5'}</span>
                                <span className="text-gray-400 font-normal">({lead.reviewsCount || '45'} تقييم)</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 font-black text-xs text-[#2B6CB0]">
                            <span>{isLeadExpanded ? 'إخفاء ▲' : 'عرض التفاصيل ▼'}</span>
                          </div>
                        </div>

                        {/* Collapsible details body */}
                        {isLeadExpanded && (
                          <div className="p-4 border-t border-slate-100 bg-[#FFFFFF] flex flex-col gap-3.5 animate-fade-in text-xs transition-all">
                            {/* Location link and header row inside expanded details */}
                            <div className="flex justify-between items-center bg-[#F7FAFC] p-2.5 rounded-xl border border-slate-150">
                              <span className="text-xs font-bold text-slate-650">موقع العميل على الخرائط:</span>
                              <a
                                href={lead.locationLink}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1 px-3 text-[11px] text-[#1A365D] hover:text-indigo-850 bg-[#FFFFFF] hover:bg-[#F7FAFC] border border-slate-200 rounded-lg font-black shrink-0 flex items-center gap-1 transition-all"
                                title="افتح موقع العميل الفعلي على خرائط جوجل"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                <span>فتح خريطة جوجل</span>
                              </a>
                            </div>

                            {/* Contacts & Direct Action Buttons */}
                            <div className="bg-[#F7FAFC]/50 border border-slate-150 p-3 rounded-xl flex flex-col gap-3">
                              <div className="flex flex-col gap-1 text-xs">
                                <span className="font-bold text-slate-650 flex items-center gap-1">
                                  <Phone className="h-3.5 w-3.5 text-[#1A365D]" />
                                  رقم التواصل الهاتف: <a href={`tel:${lead.phone}`} className="hover:underline font-mono font-bold text-[#1A365D]">{lead.phone}</a>
                                </span>
                                <span className="font-bold text-slate-650 flex items-center gap-1 mt-0.5">
                                  <MapPin className="h-3.5 w-3.5 text-emerald-500" />
                                  العنوان بالتفصيل: <strong className="text-[#1A365D] font-extrabold">{lead.detailedAddress || lead.area}</strong>
                                </span>
                              </div>

                              {/* Quick Action triggers: Direct Call, WhatsApp message, AI Generator */}
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 border-t border-slate-150/60 pt-3">
                                {/* Call Button */}
                                <a
                                  href={`tel:${lead.phone}`}
                                  className="px-3.5 py-2 bg-[#F7FAFC] hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-colors active:scale-95 text-center"
                                  title="اتصال هاتفي سريع ومباشر"
                                >
                                  <Phone className="h-3.5 w-3.5" />
                                  <span>اتصل بالعميل</span>
                                </a>

                                {/* WhatsApp Button */}
                                <a
                                  href={`https://wa.me/20${lead.phone.replace(/^0/, '')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-[#DD6B20] border border-emerald-200 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-colors active:scale-95 text-center"
                                  title="مراسلة سريعة عبر واتساب"
                                >
                                  <MessageSquare className="h-3.5 w-3.5" />
                                  <span>دردشة واتساب</span>
                                </a>

                                {/* AI Message Pitch trigger */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (activePitchLeadId === lead.id) {
                                      setActivePitchLeadId(null);
                                    } else {
                                      setActivePitchLeadId(lead.id);
                                      setAiPitchText(generateAIPitchMessage(lead.type, lead.name));
                                    }
                                  }}
                                  className={`px-3 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all active:scale-95 border cursor-pointer ${
                                    activePitchLeadId === lead.id
                                      ? 'bg-[#FFFFFF] text-[#1A365D] border-b-2 border-[#DD6B20] shadow-sm'
                                      : 'bg-indigo-50 hover:bg-indigo-100 text-[#1A365D] border-indigo-200'
                                  }`}
                                >
                                  <Sparkles className="h-3.5 w-3.5 text-[#2B6CB0]" />
                                  <span>العرض الترويجي للـ AI</span>
                                </button>
                              </div>

                              {/* Interactive Pitch draft Box */}
                              {activePitchLeadId === lead.id && (
                                <div className="bg-indigo-50/60 border border-indigo-200 p-3.5 rounded-xl flex flex-col gap-2.5 animate-fade-in text-xs mt-1">
                                  <span className="font-black text-indigo-950 flex items-center gap-1 bg-[#FFFFFF]/80 py-1 px-2.5 rounded-md border border-indigo-100 w-max mb-1">
                                    <Sparkles className="h-4 w-4 text-[#1A365D] animate-spin-slow" />
                                    مسودة عرض سوفانا الذكية المعدة من الذكاء الاصطناعي:
                                  </span>
                                  <textarea
                                    value={aiPitchText}
                                    onChange={(e) => setAiPitchText(e.target.value)}
                                    dir="rtl"
                                    className="w-full bg-[#FFFFFF] border border-indigo-100 rounded-lg p-2.5 text-xs text-[#1A365D] font-bold leading-relaxed resize-y focus:outline-none focus:ring-1 focus:ring-indigo-400 h-24"
                                  />
                                  <div className="flex flex-wrap gap-2 justify-end">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        navigator.clipboard.writeText(aiPitchText);
                                        alert('تم نسخ عرض الـ AI الترويجي المكتمل لحافظتك بنجاح!');
                                      }}
                                      className="px-3 py-1.5 bg-[#FFFFFF] border border-slate-200 text-[#1A365D] rounded-lg font-bold flex items-center gap-1 hover:bg-[#F7FAFC] transition-colors"
                                    >
                                      <Copy className="h-3.5 w-3.5 text-[#2B6CB0]" />
                                      <span>نسخ النص</span>
                                    </button>
                                    <a
                                      href={`https://wa.me/20${lead.phone.replace(/^0/, '')}?text=${encodeURIComponent(aiPitchText)}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="px-3 py-1.5 bg-[#DD6B20] text-white text-white rounded-lg font-bold flex items-center gap-1 hover:bg-[#C05621] transition-colors"
                                    >
                                      <Send className="h-3.5 w-3.5" />
                                      <span>بدء إرسال على واتس العميل</span>
                                    </a>
                                  </div>
                                </div>
                              )}

                              {/* Intelligent AI Advisor Console */}
                              {(() => {
                                const advice = getAIAdviceForStore(lead.type);
                                return (
                                  <div className="bg-amber-50/60 border border-amber-200 p-3.5 rounded-xl flex flex-col gap-2 text-xs leading-relaxed text-[#1A365D] mt-1">
                                    <span className="font-black text-amber-950 flex items-center gap-1.5 border-b border-amber-150 pb-1.5">
                                      <Sparkles className="h-4 w-4 text-amber-600 shrink-0" />
                                      مستشار البيع والولاء من خبراء التوزيع (استراتيجية {advice.ratingLabel}):
                                    </span>
                                    <p className="text-[11px] text-slate-705 leading-relaxed font-bold">
                                      {advice.bestPractice}
                                    </p>
                                    <div className="flex flex-col gap-1.5 mt-1 bg-[#FFFFFF]/70 p-2.5 rounded-lg border border-amber-100/50">
                                      <span className="font-extrabold text-[10px] text-[#1A365D] block mb-1">أفضل الطرق للتعامل وإغلاق البيع بنجاح:</span>
                                      {advice.steps.map((st, sidx) => (
                                        <div key={sidx} className="flex gap-2 items-start text-[10px]">
                                          <span className="h-4 w-4 rounded-full bg-indigo-50 text-[#1A365D] border border-indigo-200 shrink-0 flex items-center justify-center font-black text-[9px] mt-0.5">{sidx + 1}</span>
                                          <span className="text-slate-750 font-bold">{st}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>

                            {/* Staging Save Action inside expanded details */}
                            <div className="flex justify-end pt-1.5 border-t border-slate-100">
                              <button
                                type="button"
                                onClick={() => handleAddMapLeadToGoogleLeads(lead)}
                                disabled={isAdded}
                                className={`w-full sm:w-auto px-4.5 py-2.5 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 shrink-0 active:scale-95 duration-75 cursor-pointer ${
                                  isAdded
                                    ? 'bg-emerald-50 text-[#DD6B20] border border-emerald-100 cursor-not-allowed'
                                    : 'bg-[#1A365D] text-white border-transparent hover:bg-[#1A365D] text-white border-transparent text-white shadow-sm hover:shadow'
                                }`}
                              >
                                {isAdded ? (
                                  <>
                                    <Check className="h-4 w-4 text-[#DD6B20]" />
                                    <span>تم الحفظ بـ عملاء جوجل✓</span>
                                  </>
                                ) : (
                                  <>
                                    <Plus className="h-4 w-4" />
                                    <span>حفظ بـ عملاء جوجل للمتابعة</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* General Advice */}
            <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100 text-[11px] text-amber-805 leading-relaxed font-bold">
              💡 نصيحة التحرير: يمكنك استخدام فلتر خرائط ماب هذا لاستكشاف كل البقالات والسوبرماركتات النشطة بالمنطقة، والاتصال بهواتفهم لعرّض منتجات وأسعار كرتونة زيوت وسمن سوفانا بالهامش التنافسي، وبمجرد تأكيد رغبتهم بالطلب تضاف بضغطة واحدة وتظهر فور ببيان المندوب والتحميل!
            </div>
          </div>
        )}

        {/* 3. Google Leads Staging Tab - NEW */}
        {activeTab === 'google_leads' && (
          <div className="flex flex-col gap-4 animate-fade-in" id="google-leads-tab">
            <div className="bg-[#FFFFFF] p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4">
              <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
                <div className="flex flex-col">
                  <h3 className="font-bold text-[#1A365D] text-base">عملاء جوجل المستجلبين للمتابعة</h3>
                  <p className="text-[10.5px] text-[#2B6CB0] font-bold mt-0.5">عملاء مقترحين تم سحبهم للاتصال والتحويل لعملاء دائمين</p>
                </div>
                <span className="text-xs bg-indigo-50 text-indigo-750 font-black px-2.5 py-1 rounded-lg border border-indigo-150 animate-pulse">
                  {googleLeads.length} عميل مقترح
                </span>
              </div>

              {googleLeads.length === 0 ? (
                <div className="text-center py-10 flex flex-col items-center justify-center gap-2">
                  <Compass className="h-8 w-8 text-indigo-300 animate-pulse" />
                  <p className="text-gray-400 text-sm font-bold">لا يوجد عملاء مستجلبين من جوجل للمتابعة حالياً.</p>
                  <p className="text-[11px] text-slate-450 leading-relaxed max-w-xs mt-1">
                    يرجى الذهاب أولا لتبويب <span className="text-[#1A365D] font-bold">"استكشاف عملاء"</span> للبحث بالمدن وسحب المحلات، ثم الضغط على "حفظ بـ عملاء جوجل للمتابعة" لتظهر في مسودتك هنا!
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3.5">
                  {googleLeads.map((lead) => {
                    const alreadyRealCustomer = customers.some(c => c.phone === lead.phone || c.name.toLowerCase() === lead.name.toLowerCase());
                    const showConfirmed = lead.confirmed || alreadyRealCustomer;
                    const isStagedExpanded = !!expandedStagedLeads[lead.id];

                    return (
                      <div key={lead.id} className={`border rounded-xl overflow-hidden transition-all flex flex-col ${
                        showConfirmed ? 'bg-emerald-50/40 border-emerald-150/60' : 'bg-[#FFFFFF] border-slate-200 hover:border-slate-350 shadow-sm'
                      }`}>
                        
                        {/* Watchlist Header - Toggle Collapsible Card */}
                        <div 
                          onClick={() => setExpandedStagedLeads(prev => prev[lead.id] ? {} : { [lead.id]: true })}
                          className="p-4 bg-[#F7FAFC]/50 hover:bg-[#F7FAFC] flex items-center justify-between gap-4 cursor-pointer select-none"
                        >
                          <div className="flex flex-col gap-1 text-sm select-none">
                            <span className="font-extrabold text-slate-850 text-base flex items-center gap-1.5 leading-snug">
                              {showConfirmed ? (
                                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shrink-0"></span>
                              ) : (
                                <span className={`h-2.5 w-2.5 rounded-full shrink-0 transition-all ${isStagedExpanded ? 'bg-[#FFFFFF] text-[#1A365D] border-b-2 border-[#DD6B20] shadow-sm' : 'bg-amber-400'}`}></span>
                              )}
                              {lead.name}
                            </span>
                            <div className="flex flex-wrap gap-1.5 mt-0.5">
                              <span className="text-[10px] text-[#1A365D] font-extrabold bg-indigo-50 py-0.5 px-2 rounded border border-indigo-100">
                                {lead.type || 'نشاط تجاري'}
                              </span>
                              {lead.dateAdded && (
                                <span className="text-[9.5px] text-[#2B6CB0] bg-[#FFFFFF] py-0.5 px-1.5 rounded border border-slate-150 font-mono font-bold">
                                  تاريخ السحب: {lead.dateAdded}
                                </span>
                              )}
                              {showConfirmed && (
                                <span className="text-[10px] text-[#DD6B20] font-extrabold bg-emerald-100/80 py-0.5 px-1.5 rounded border border-emerald-205">
                                  شريك معتمد في قائمة المنطقة ✓
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 font-black text-xs text-[#2B6CB0]">
                            <span>{isStagedExpanded ? 'إخفاء ▲' : 'عرض التفاصيل والخيارات ▼'}</span>
                          </div>
                        </div>

                        {/* Watchlist Card Content */}
                        {isStagedExpanded && (
                          <div className="p-4 border-t border-slate-100 bg-[#FFFFFF] flex flex-col gap-3.5 animate-fade-in transition-all">
                            
                            {/* Actions Top bar: Map link & Delete draft */}
                            <div className="flex justify-between items-center bg-[#F7FAFC] p-2.5 rounded-xl border border-slate-150 flex-wrap sm:flex-nowrap gap-2">
                              <span className="text-xs font-bold text-slate-650">خرائط ومسودات جوجل:</span>
                              <div className="flex items-center gap-1.5">
                                {lead.locationLink && (
                                  <a
                                    href={lead.locationLink}
                                    target="_blank"
                                    rel="referrer"
                                    className="p-1 px-3 bg-[#FFFFFF] text-[#1A365D] border border-slate-200 hover:bg-[#F7FAFC] rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                                    title="عرض الموقع المكتشف بخرائط جوجل"
                                  >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                    <span>فتح الموقع بالخرائط</span>
                                  </a>
                                )}
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (await confirmDialog('هل تود إزالة هذا العميل المقترح من المسودة/القائمة؟')) {
                                      handleDeleteGoogleLead(lead.id);
                                    }
                                  }}
                                  className="p-1 px-2.5 text-rose-500 hover:bg-rose-50 border border-transparent hover:border-rose-100 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                                  title="حذف المقترح"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  <span>مسح</span>
                                </button>
                              </div>
                            </div>

                            {/* Contacts & Direct Action Buttons */}
                            <div className="bg-[#F7FAFC]/50 border border-slate-150 p-3 rounded-xl flex flex-col gap-3">
                              <div className="flex flex-col gap-1 text-xs">
                                <span className="font-bold text-slate-650 flex items-center gap-1">
                                  <Phone className="h-3.5 w-3.5 text-[#1A365D]" />
                                  رقم الهاتف: <a href={`tel:${lead.phone}`} className="hover:underline font-mono font-bold text-[#1A365D]">{lead.phone}</a>
                                </span>
                                <span className="font-bold text-slate-650 flex items-center gap-1 mt-0.5">
                                  <MapPin className="h-3.5 w-3.5 text-emerald-500" />
                                  العنوان بالتفصيل: <strong className="text-[#1A365D] font-extrabold">{lead.detailedAddress || lead.area}</strong>
                                </span>
                              </div>

                              {/* WhatsApp & Dialing buttons for staging checklist */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 border-t border-slate-150/60 pt-3">
                                <a
                                  href={`tel:${lead.phone}`}
                                  className="px-3.5 py-1.5 bg-[#F7FAFC] hover:bg-blue-100/85 text-blue-700 border border-blue-200 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-colors active:scale-95 text-center"
                                  title="اتصال هاتفي مباشر"
                                >
                                  <Phone className="h-3.5 w-3.5" />
                                  <span>اتصال هاتفي</span>
                                </a>

                                <a
                                  href={`https://wa.me/20${lead.phone.replace(/^0/, '')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100/85 text-[#DD6B20] border border-emerald-200 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-colors active:scale-95 text-center"
                                  title="مراسلة سريعة عبر واتساب"
                                >
                                  <MessageSquare className="h-3.5 w-3.5" />
                                  <span>واتساب مباشر</span>
                                </a>
                              </div>
                            </div>

                            {/* Staging Confirmation Action Button */}
                            <div className="flex justify-end pt-1.5 border-t border-slate-100">
                              <button
                                type="button"
                                onClick={() => handleConfirmGoogleLead(lead)}
                                disabled={showConfirmed}
                                className={`w-full sm:w-auto px-4.5 py-2.5 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 shrink-0 hover:shadow active:scale-95 cursor-pointer ${
                                  showConfirmed
                                    ? 'bg-emerald-50 text-[#DD6B20] border border-emerald-100 cursor-not-allowed'
                                    : 'bg-[#DD6B20] text-white hover:bg-[#C05621] text-white shadow'
                                }`}
                              >
                                {showConfirmed ? (
                                  <>
                                    <Check className="h-4 w-4" />
                                    <span>تم التأكيد والإضافة المعتمدة ✓</span>
                                  </>
                                ) : (
                                  <>
                                    <Check className="h-4 w-4" />
                                    <span>تأكيد وإضافته للعملاء الفعليين بالمنطقة</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-150 text-[11px] text-[#2B6CB0] leading-relaxed font-bold">
              💡 <span className="text-[#1A365D] font-extrabold">مفهوم التشغيل المنظم:</span> هذه القائمة مخصصة فقط للعملاء المتوقع تفعيلهم الذين يتم الاتصال بهم لتسليم السعر وعينات العبوة. بمجرد تأكيد رغبتهم بالطلب الفعلي، اضغط على زر <span className="text-[#DD6B20] font-extrabold">"تأكيد وإضافته للعملاء الفعليين"</span>، ليتم تلقائياً ترحيله إلى تبويب <span className="text-[#1A365D] font-extrabold">"العملاء"</span> الفعليين الذين تفتح لهم الفواتير ويظهرون ببيان السيارة وبيانات التوزيع!
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
