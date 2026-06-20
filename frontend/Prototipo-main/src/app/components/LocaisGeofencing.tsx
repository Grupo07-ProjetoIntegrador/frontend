import { useEffect, useState, useRef } from "react";
import { MapPin, Shield, Plus, List, ArrowLeft, Navigation, ZoomIn, ZoomOut, CheckCircle2, AlertCircle, Save } from "lucide-react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "./ui/card";
import { toast } from "sonner";

const API_BASE_URL = "https://jpmallflamboyant.live/api";

type LocalGeofence = {
  id?: string;
  nome_local: string;
  latitude: number;
  longitude: number;
  raio_amplitude: number;
};

export function LocaisGeofencing() {
  const [locais, setLocais] = useState<LocalGeofence[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Form State
  const [nomeLocal, setNomeLocal] = useState("");
  const [latitude, setLatitude] = useState(-16.7090);
  const [longitude, setLongitude] = useState(-49.2390);
  const [raioAmplitude, setRaioAmplitude] = useState(150);
  const [isSaving, setIsSaving] = useState(false);

  // Map Simulation State
  const [zoom, setZoom] = useState(16);
  const [markerPos, setMarkerPos] = useState<{ x: number; y: number } | null>({ x: 250, y: 180 });
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Load existing locations
  const carregarLocais = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/locais`);
      if (response.ok) {
        const data = await response.json();
        setLocais(data || []);
      } else {
        toast.error("Erro ao carregar locais cadastrados.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível conectar ao backend Go.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    carregarLocais();
  }, []);

  // Handle Map Click (Simulated Google Maps interaction)
  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!mapContainerRef.current) return;
    const rect = mapContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setMarkerPos({ x, y });

    // Map pixel to coordinate simulation (around Flamboyant Mall: -16.709, -49.239)
    // Center of map is (-16.7090, -49.2390) at x=250, y=180
    const scale = 0.00002 / (zoom / 16);
    const deltaX = x - 250;
    const deltaY = y - 180;

    const newLat = -16.7090 - deltaY * scale;
    const newLon = -49.2390 + deltaX * scale;

    setLatitude(Number(newLat.toFixed(6)));
    setLongitude(Number(newLon.toFixed(6)));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeLocal) {
      toast.error("Preencha o nome do local");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/locais/cadastrar`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nome_local: nomeLocal,
          latitude: Number(latitude),
          longitude: Number(longitude),
          raio_amplitude: Number(raioAmplitude),
        }),
      });

      if (response.ok) {
        toast.success("Local de Geofencing cadastrado com sucesso!");
        setNomeLocal("");
        carregarLocais();
      } else {
        const errData = await response.json();
        toast.error(errData.erro || "Erro ao salvar local.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro na comunicação com o backend.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="flex-1 min-h-screen flex flex-col p-4 md:p-8" style={{ backgroundColor: "#F7F4EF" }}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-gray-900 flex items-center gap-2">
            <Shield className="w-6 h-6 text-[#D93030]" />
            Cercas Virtuais (Geofencing)
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Cadastre pontos e limites geográficos para validação do check-in automático dos lojistas.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Form and List */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="bg-white border border-gray-200 shadow-sm">
            <CardHeader className="border-b border-gray-100">
              <CardTitle className="text-base font-semibold text-gray-900">Novo Ponto de Geofencing</CardTitle>
              <CardDescription>Defina as coordenadas clicando no mapa ao lado.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1.5">
                    Nome do Local
                  </label>
                  <Input
                    type="text"
                    placeholder="Ex: Auditório Principal, Entrada Sul..."
                    value={nomeLocal}
                    onChange={(e) => setNomeLocal(e.target.value)}
                    className="bg-gray-50 border-gray-200 text-sm h-10"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase mb-1.5">
                      Latitude
                    </label>
                    <Input
                      type="number"
                      step="any"
                      value={latitude}
                      onChange={(e) => setLatitude(Number(e.target.value))}
                      className="bg-gray-50 border-gray-200 text-sm h-10"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase mb-1.5">
                      Longitude
                    </label>
                    <Input
                      type="number"
                      step="any"
                      value={longitude}
                      onChange={(e) => setLongitude(Number(e.target.value))}
                      className="bg-gray-50 border-gray-200 text-sm h-10"
                      required
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-semibold text-gray-700 uppercase">
                      Raio de Amplitude (Cerca)
                    </label>
                    <span className="text-xs font-bold text-[#D93030]">{raioAmplitude} metros</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="1000"
                    step="10"
                    value={raioAmplitude}
                    onChange={(e) => setRaioAmplitude(Number(e.target.value))}
                    className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#D93030]"
                  />
                  <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                    <span>10m</span>
                    <span>500m</span>
                    <span>1000m</span>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isSaving}
                  className="w-full bg-[#D93030] hover:bg-[#B82525] text-white flex items-center justify-center gap-2 h-11 text-sm font-semibold transition-colors mt-6 shadow-sm rounded-lg"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? "Salvando..." : "Salvar Cerca Virtual"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* List existing */}
          <Card className="bg-white border border-gray-200 shadow-sm">
            <CardHeader className="border-b border-gray-100 py-4">
              <CardTitle className="text-sm font-bold text-gray-800 flex items-center gap-2">
                <List className="w-4 h-4 text-gray-500" />
                Locais Cadastrados ({locais.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 max-h-72 overflow-y-auto">
              {isLoading ? (
                <div className="p-6 text-center text-sm text-gray-500">Carregando locais...</div>
              ) : locais.length === 0 ? (
                <div className="p-6 text-center text-sm text-gray-500">Nenhum local cadastrado ainda.</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {locais.map((loc) => (
                    <div key={loc.id} className="p-4 flex justify-between items-start hover:bg-gray-50 transition-colors">
                      <div>
                        <p className="font-semibold text-sm text-gray-900">{loc.nome_local}</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          Lat: {loc.latitude} | Lon: {loc.longitude}
                        </p>
                      </div>
                      <span className="text-[11px] font-bold text-[#D93030] bg-red-50 border border-red-100 px-2 py-0.5 rounded-full shrink-0">
                        Raio: {loc.raio_amplitude}m
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Map Container */}
        <div className="lg:col-span-7">
          <Card className="bg-white border border-gray-200 shadow-sm overflow-hidden h-[540px] flex flex-col">
            <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div>
                <CardTitle className="text-sm font-bold text-gray-800">Mapa do Geofencing</CardTitle>
                <p className="text-xs text-gray-500">Clique para fixar o ponto da cerca virtual</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setZoom(prev => Math.min(18, prev + 1))}
                  className="p-1.5 bg-white border border-gray-200 rounded hover:bg-gray-100 transition-colors shadow-sm"
                  title="Aumentar Zoom"
                >
                  <ZoomIn className="w-4 h-4 text-gray-600" />
                </button>
                <button
                  onClick={() => setZoom(prev => Math.max(14, prev - 1))}
                  className="p-1.5 bg-white border border-gray-200 rounded hover:bg-gray-100 transition-colors shadow-sm"
                  title="Diminuir Zoom"
                >
                  <ZoomOut className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            </div>

            {/* Map Body (Visual Simulation of Mall Layout Map with SVG / Grid) */}
            <div
              ref={mapContainerRef}
              onClick={handleMapClick}
              className="flex-1 bg-slate-100 relative overflow-hidden cursor-crosshair select-none"
              style={{
                backgroundImage: "radial-gradient(#CBD5E1 1px, transparent 1px)",
                backgroundSize: "20px 20px"
              }}
            >
              {/* Mall Layout Graphic Simulation */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
                <div className="w-[80%] h-[70%] border-4 border-slate-300 rounded-2xl relative bg-slate-50 flex items-center justify-center">
                  <div className="grid grid-cols-4 gap-4 p-8 w-full h-full">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="border-2 border-slate-200 bg-white/80 rounded flex items-center justify-center text-[10px] font-bold text-slate-400">
                        LOJA {101 + i}
                      </div>
                    ))}
                  </div>
                  <span className="absolute bottom-2 right-4 text-[10px] font-bold text-slate-400">JP Mall Center - Planta</span>
                </div>
              </div>

              {/* Existing Geofences drawn on map */}
              {locais.map((loc, idx) => {
                // Map coordinates back to screen pixels (rough estimate for visualization)
                const deltaLat = loc.latitude - (-16.7090);
                const deltaLon = loc.longitude - (-49.2390);
                const scale = 0.00002 / (zoom / 16);
                
                const x = 250 + deltaLon / scale;
                const y = 180 - deltaLat / scale;

                if (x < 0 || x > 700 || y < 0 || y > 500) return null;

                const radiusPixels = loc.raio_amplitude * (zoom / 16) * 0.15;

                return (
                  <div key={idx} className="absolute pointer-events-none" style={{ left: x, top: y }}>
                    {/* Circle */}
                    <div
                      className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-gray-400/60 bg-gray-400/10"
                      style={{
                        width: radiusPixels * 2,
                        height: radiusPixels * 2,
                      }}
                    />
                    {/* Tiny marker */}
                    <div className="w-2 h-2 bg-gray-500 rounded-full -translate-x-1/2 -translate-y-1/2" />
                    <div className="absolute left-2 -translate-y-1/2 text-[9px] bg-white border border-gray-200 px-1 py-0.5 rounded shadow-sm text-gray-600 font-bold whitespace-nowrap">
                      {loc.nome_local}
                    </div>
                  </div>
                );
              })}

              {/* Current Editing Cerca (Marker & Circle) */}
              {markerPos && (
                <div
                  className="absolute transition-all duration-150 ease-out"
                  style={{ left: markerPos.x, top: markerPos.y }}
                >
                  {/* Dynamic Geofence Radius Circle */}
                  <div
                    className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#D93030]/40 bg-[#D93030]/10 animate-pulse"
                    style={{
                      width: raioAmplitude * (zoom / 16) * 0.3,
                      height: raioAmplitude * (zoom / 16) * 0.3,
                    }}
                  />
                  {/* Pin Icon */}
                  <div className="absolute -translate-x-1/2 -bottom-1 pointer-events-none">
                    <MapPin className="w-8 h-8 text-[#D93030] fill-[#D93030]/20 drop-shadow-md animate-bounce" />
                    <div className="w-2 h-2 bg-[#D93030] rounded-full blur-[1px] mx-auto mt-[-4px]" />
                  </div>
                </div>
              )}

              {/* Map Stats Panel overlay */}
              <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur border border-gray-200 rounded-lg p-3 text-[11px] font-semibold text-gray-700 shadow-md space-y-1 pointer-events-none">
                <div className="flex items-center gap-1.5">
                  <Navigation className="w-3.5 h-3.5 text-[#D93030]" />
                  <span>Centro: -16.7090, -49.2390</span>
                </div>
                <div className="text-gray-400">Escala: {raioAmplitude}m selecionados</div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}
