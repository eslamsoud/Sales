// @ts-nocheck
import React from 'react';
import { MapPin, Printer, Download, CheckCircle2 } from 'lucide-react';
import { Trip, formatNum } from '../../types';

export interface TripsArchiveSectionProps {
  filteredArchiveTrips: Trip[];
  groupedTripsByYearMonth: [string, [string, Trip[]][]][];
  openArchiveSection: string | null;
  setOpenArchiveSection: (val: string | null) => void;
  openTripsYear: string | null;
  setOpenTripsYear: (val: string | null) => void;
  openTripsMonth: string | null;
  setOpenTripsMonth: (val: string | null) => void;
  monthNames: string[];
  downloadCollectedTripsPDF: () => void;
  downloadCollectedTripsImage: () => void;
  downloadTripsMonthPDF: (monthTrips: Trip[], year: string, month: string) => void;
}

export default function TripsArchiveSection({
  filteredArchiveTrips,
  groupedTripsByYearMonth,
  openArchiveSection,
  setOpenArchiveSection,
  openTripsYear,
  setOpenTripsYear,
  openTripsMonth,
  setOpenTripsMonth,
  monthNames,
  downloadCollectedTripsPDF,
  downloadCollectedTripsImage,
  downloadTripsMonthPDF,
}: TripsArchiveSectionProps) {
  return (
    <div className="bg-purple-50/30 border border-purple-200 rounded-xl p-4">
      <button
        type="button"
        onClick={() => { setOpenArchiveSection(openArchiveSection === 'trips' ? null : 'trips'); setOpenTripsYear(null); setOpenTripsMonth(null); }}
        className={`w-full text-right flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer select-none ${
          openArchiveSection === 'trips' ? 'bg-purple-100 text-purple-800 shadow-sm' : 'bg-purple-50/50 text-purple-600 hover:bg-purple-100/50'
        }`}
      >
        <span>{openArchiveSection === 'trips' ? '📂' : '📁'}</span>
        <MapPin className="h-4 w-4" />
        <span>أرشيف المشاوير المسددة ({filteredArchiveTrips.length} مشوار)</span>
      </button>

    {openArchiveSection === 'trips' && (
      <div className="flex flex-col gap-3 animate-fade-in mt-3">

        {filteredArchiveTrips.length > 0 && (
          <div className="flex gap-3 w-full">
            <button
              type="button"
              onClick={downloadCollectedTripsPDF}
              className="flex-1 bg-[#3b0764] hover:bg-[#581c87] text-white py-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-xs cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              <span>تنزيل كل أرشيف المشاوير (PDF)</span>
            </button>
            <button
              type="button"
              onClick={downloadCollectedTripsImage}
              className="flex-1 bg-[#9333ea] hover:bg-[#7e22ce] text-white py-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-xs cursor-pointer"
            >
              <Download className="h-4 w-4" />
              <span>تنزيل صورة كل أرشيف المشاوير</span>
            </button>
          </div>
        )}

        {groupedTripsByYearMonth.length === 0 ? (
          <div className="text-center py-10 bg-[#F7FAFC] rounded-2xl border border-dashed border-slate-200">
            <p className="text-sm text-gray-400 font-bold">لا توجد مشاوير مسددة مؤرشفة.</p>
          </div>
        ) : (
          groupedTripsByYearMonth.map(([year, months]) => (
            <div key={year} className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setOpenTripsYear(openTripsYear === year ? null : year)}
                className={`w-full text-right px-4 py-2.5 rounded-xl text-sm font-bold flex items-center justify-between gap-2 transition-all cursor-pointer select-none ${
                  openTripsYear === year
                    ? 'bg-purple-100 text-purple-800 shadow-sm'
                    : 'bg-purple-50/50 text-purple-600 hover:bg-purple-100/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">{openTripsYear === year ? '📂' : '📁'}</span>
                  <span>مشاوير سنة {year}</span>
                </div>
                <span className="text-[10px] bg-purple-200 text-purple-700 px-2 py-0.5 rounded-full font-bold">
                  {months.reduce((sum, [, trips]) => sum + trips.length, 0)} مشوار
                </span>
              </button>
              {openTripsYear === year && (
                <div className="flex flex-col gap-2 pr-4 border-r-2 border-purple-100 mr-2">
                  {months.map(([month, trips]) => (
                    <div key={month} className="flex flex-col gap-2">
                      <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setOpenTripsMonth(openTripsMonth === year + month ? null : year + month)}
                        className={`flex-1 w-full text-right px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-between gap-2 transition-all cursor-pointer select-none ${
                          openTripsMonth === year + month
                            ? 'bg-violet-100 text-violet-800'
                            : 'bg-violet-50/50 text-violet-600 hover:bg-violet-100/50'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>{openTripsMonth === year + month ? '🔽' : '▶️'}</span>
                          <span>شهر {monthNames[parseInt(month) - 1]}</span>
                        </div>
                        <span className="text-[10px] bg-violet-200 text-violet-700 px-2 py-0.5 rounded-full font-bold">{trips.length} مشاوير</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadTripsMonthPDF(trips, year, month)}
                        title={`تنزيل PDF — شهر ${monthNames[parseInt(month) - 1]} ${year}`}
                        className="shrink-0 bg-[#3b0764] hover:bg-[#581c87] text-white p-1.5 rounded-lg transition-all cursor-pointer active:scale-95 shadow-xs"
                      >
                        <Printer className="h-3.5 w-3.5" />
                      </button>
                      </div>
                      {openTripsMonth === year + month && (
                        <div className="flex flex-col gap-2 pr-2">
                          <button
                            type="button"
                            onClick={() => downloadTripsMonthPDF(trips, year, month)}
                            className="w-full bg-[#3b0764] hover:bg-[#581c87] text-white py-1.5 rounded-lg text-[10px] font-extrabold flex items-center justify-center gap-1 active:scale-95 transition-all shadow-xs cursor-pointer"
                          >
                            <Printer className="h-3 w-3" /> تنزيل PDF — شهر {monthNames[parseInt(month) - 1]} {year}
                          </button>
                          {[...trips].reverse().map((trip) => (
                            <div
                              key={trip.id}
                              className="border rounded-xl p-3.5 flex flex-col gap-3 text-xs shadow-xs transition-all bg-purple-50/40 border-purple-100"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex flex-col gap-1 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-extrabold text-[#1A365D] text-sm">{trip.description}</span>
                                    <span className="text-[10px] bg-[#F7FAFC] border border-slate-200 text-[#2B6CB0] font-bold font-mono p-0.5 px-1.5 rounded">{trip.date}</span>
                                  </div>
                                  <span className="font-mono text-[#1A365D] font-bold block mt-0.5">السعر المسدد: {formatNum(trip.price)} ج.م</span>
                                  {trip.delegateName && <span className="text-[10px] text-slate-500">المندوب: {trip.delegateName}</span>}
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <CheckCircle2 className="h-5 w-5 text-[#DD6B20]" />
                                  <span className="text-emerald-800 font-bold">مسدد</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
      )}
      </div>
  );
}
