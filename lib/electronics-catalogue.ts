/**
 * The electronics atlas: 200+ product lines, from the materials inside a
 * smartphone to the machines that make chips, each named by its six-digit HS
 * code so that UN Comtrade can say who exports it.
 *
 * What this measures, and what it does not: Comtrade records trade, not
 * production. "China's share" on /breakneck/india is China's share of world
 * exports of the line, summed over every country that reported that year. It
 * is the best public measure of who supplies the world, and it differs from a
 * production share wherever a country makes things for itself (China builds
 * most of its own EVs and keeps them) or re-exports what others made (Hong
 * Kong, the Netherlands, Singapore), which also counts the same goods twice
 * in a world total. Taiwan's trade is in Comtrade as "Other Asia, nes"
 * (code 490), and the page names it Taiwan.
 * The page says all of this beside the numbers.
 *
 * Every entry carries `key`, a word that must appear in the official HS
 * description in data/trade/hs6-universe.json; the test fails if it does not,
 * so a mistyped code cannot quietly measure the wrong thing.
 */

export type SectorId =
  | "compute" | "chips" | "phones" | "passives" | "power" | "energy" | "display" | "camera"
  | "audio" | "telecom" | "drones" | "factory" | "instruments" | "home" | "medical" | "materials";

export interface Sector { id: SectorId; label: string; blurb: string }

export const SECTORS: Sector[] = [
  { id: "chips", label: "Chips & chipmaking", blurb: "Processors, memory, power semiconductors, sensors — and the machines and materials that make them." },
  { id: "compute", label: "Computers, servers & AI hardware", blurb: "Laptops, servers, storage, the boards inside them, and printers." },
  { id: "phones", label: "Phones & personal devices", blurb: "Handsets, SIM and smart cards, flash storage and wearables." },
  { id: "passives", label: "Boards, passives & connectors", blurb: "The unglamorous parts on every circuit board: PCBs, capacitors, resistors, connectors, cables." },
  { id: "power", label: "Batteries, motors & magnets", blurb: "Cells, chargers and inverters, electric motors, rare-earth magnets, switchgear." },
  { id: "energy", label: "Solar, wind, EVs & grid", blurb: "Clean-energy hardware and electric vehicles." },
  { id: "display", label: "Displays, TVs & lighting", blurb: "Screens and display modules, TVs, monitors, projectors, LED lighting." },
  { id: "camera", label: "Cameras & optics", blurb: "Cameras of every kind, lenses, lasers and optical parts." },
  { id: "audio", label: "Audio & music electronics", blurb: "Speakers, headphones, microphones, amplifiers, electric instruments." },
  { id: "telecom", label: "Networking, telecom & navigation", blurb: "Base stations, routers, antennas, radios, radar, GPS, optical fibre." },
  { id: "drones", label: "Drones, robots & motion", blurb: "Unmanned aircraft by weight class, industrial robots, bearings, gears, navigation." },
  { id: "factory", label: "Machine tools & factory equipment", blurb: "The machines that make the machines: CNC tools, presses, moulding, 3D printing, welding." },
  { id: "instruments", label: "Instruments, sensors & control", blurb: "Controllers, meters, test gear, analysers and alarms." },
  { id: "home", label: "Home appliances & gadgets", blurb: "Kitchen and household electronics, consoles, toys, watches." },
  { id: "medical", label: "Medical electronics", blurb: "Scanners, monitors, hearing aids, pacemakers." },
  { id: "materials", label: "Critical materials", blurb: "Rare earths, lithium, cobalt, graphite and other inputs electronics cannot do without." },
];

export interface CatalogueItem {
  hs: string;
  sector: SectorId;
  name: string;
  /** A word or phrase that must appear in the official HS description (case-insensitive). */
  key: string;
  /** Marks the lines the page treats as the AI and data-centre supply chain. */
  ai?: boolean;
}

const I = (hs: string, sector: SectorId, name: string, key: string, ai?: boolean): CatalogueItem => ({ hs, sector, name, key, ...(ai ? { ai } : {}) });

export const CATALOGUE: CatalogueItem[] = [
  /* ── chips & chipmaking ─────────────────────────────────────────────── */
  I("854231", "chips", "Processors and controllers (CPUs, GPUs, AI accelerators)", "processors", true),
  I("854232", "chips", "Memory chips (DRAM, NAND, HBM)", "memories", true),
  I("854233", "chips", "Amplifier chips", "amplifiers"),
  I("854239", "chips", "Other integrated circuits", "integrated circuits", true),
  I("854290", "chips", "Parts of integrated circuits", "parts"),
  I("854110", "chips", "Diodes", "diodes"),
  I("854121", "chips", "Small transistors (under 1 W)", "transistors"),
  I("854129", "chips", "Power transistors (MOSFETs, IGBTs)", "transistors"),
  I("854130", "chips", "Thyristors, diacs and triacs", "thyristors"),
  I("854141", "chips", "LEDs (light-emitting diodes)", "light emitting"),
  I("854149", "chips", "Photosensitive devices (photodiodes, sensor dies)", "photosensitive"),
  I("854151", "chips", "Semiconductor sensors and MEMS transducers", "transducers"),
  I("854159", "chips", "Other semiconductor devices", "semiconductor"),
  I("854160", "chips", "Quartz crystals and resonators", "piezo-electric"),
  I("854190", "chips", "Parts of semiconductor devices", "parts"),
  I("848610", "chips", "Machines to make silicon ingots and wafers", "wafers"),
  I("848620", "chips", "Chipmaking equipment (fab tools)", "semiconductor devices", true),
  I("848630", "chips", "Machines to make flat-panel displays", "flat panel displays"),
  I("848640", "chips", "Mask-making and chip-packaging machines", "masks"),
  I("848690", "chips", "Parts of chip and display-making machines", "parts"),
  I("903082", "chips", "Wafer and device test instruments", "semiconductor wafers"),
  I("903141", "chips", "Optical wafer and mask inspection", "semiconductor wafers"),
  I("381800", "chips", "Doped silicon wafers", "doped"),
  I("280461", "chips", "Polysilicon (silicon over 99.99% pure)", "silicon"),
  I("280469", "chips", "Metallurgical silicon", "silicon"),

  /* ── computers, servers & AI hardware ───────────────────────────────── */
  I("847130", "compute", "Laptops and tablets", "portable"),
  I("847141", "compute", "Desktop computers", "same housing"),
  I("847149", "compute", "Computer systems", "systems"),
  I("847150", "compute", "Servers and processing units", "processing units", true),
  I("847160", "compute", "Keyboards, mice and other input/output units", "input or output units"),
  I("847170", "compute", "Storage units (hard drives, SSD units)", "storage units", true),
  I("847180", "compute", "Other computer units (accelerator and network units)", "units", true),
  I("847190", "compute", "Card readers and other data-processing machines", "readers"),
  I("847330", "compute", "Computer parts (motherboards, graphics cards)", "8471", true),
  I("844332", "compute", "Printers", "single-function"),
  I("844331", "compute", "Multifunction printers", "two or more"),
  I("844399", "compute", "Printer parts and cartridges", "parts and accessories"),

  /* ── phones & personal devices ─────────────────────────────────────── */
  I("851713", "phones", "Smartphones", "smartphones"),
  I("851714", "phones", "Feature phones and other cellular handsets", "cellular"),
  I("851711", "phones", "Cordless phones", "cordless"),
  I("851718", "phones", "Other telephone sets", "telephone sets"),
  I("851779", "phones", "Parts of phones and network equipment", "parts"),
  I("852352", "phones", "Smart cards (SIM and payment chips)", "smart cards"),
  I("852351", "phones", "Flash storage: memory cards and USB drives", "solid-state"),
  I("910212", "phones", "Digital watches", "opto-electronic"),

  /* ── boards, passives & connectors ─────────────────────────────────── */
  I("853400", "passives", "Printed circuit boards", "printed", true),
  I("853221", "passives", "Tantalum capacitors", "tantalum"),
  I("853222", "passives", "Aluminium electrolytic capacitors", "aluminium electrolytic"),
  I("853223", "passives", "Single-layer ceramic capacitors", "single layer"),
  I("853224", "passives", "Multilayer ceramic capacitors (MLCC)", "multilayer"),
  I("853225", "passives", "Film capacitors", "plastics"),
  I("853229", "passives", "Other fixed capacitors", "fixed"),
  I("853290", "passives", "Capacitor parts", "parts"),
  I("853310", "passives", "Carbon resistors", "carbon"),
  I("853321", "passives", "Small fixed resistors (up to 20 W)", "fixed"),
  I("853340", "passives", "Variable resistors and potentiometers", "variable"),
  I("853610", "passives", "Fuses", "fuses"),
  I("853620", "passives", "Small automatic circuit breakers", "circuit breakers"),
  I("853641", "passives", "Relays (up to 60 V)", "relays"),
  I("853650", "passives", "Switches", "switches"),
  I("853669", "passives", "Plugs and sockets", "plugs and sockets"),
  I("853670", "passives", "Optical-fibre connectors", "optical fibres"),
  I("853690", "passives", "Connectors and other circuit apparatus", "8536"),
  I("854411", "passives", "Copper winding wire", "winding wire"),
  I("854442", "passives", "Cables with connectors", "fitted with connectors", true),
  I("854449", "passives", "Other low-voltage cables", "conductors"),
  I("854470", "passives", "Optical-fibre cables", "optical fibre cables", true),
  I("850450", "passives", "Inductors", "inductors"),
  I("850431", "passives", "Small transformers (up to 1 kVA)", "transformers"),
  I("850490", "passives", "Transformer and power-supply parts", "parts"),
  I("853120", "passives", "LED and LCD indicator panels", "indicator panels"),
  I("853180", "passives", "Buzzers, sirens and signalling devices", "signalling"),
  I("854370", "passives", "Other electrical machines with their own function", "individual functions"),

  /* ── batteries, motors & magnets ───────────────────────────────────── */
  I("850760", "power", "Lithium-ion batteries", "lithium-ion"),
  I("850750", "power", "Nickel-metal hydride batteries", "nickel-metal hydride"),
  I("850710", "power", "Lead-acid starter batteries", "lead-acid"),
  I("850720", "power", "Other lead-acid batteries", "lead-acid"),
  I("850780", "power", "Other rechargeable batteries (incl. sodium-ion)", "accumulators"),
  I("850790", "power", "Battery parts (separators, cases, plates)", "parts"),
  I("850650", "power", "Lithium primary cells", "lithium"),
  I("850610", "power", "Alkaline cells", "manganese dioxide"),
  I("850440", "power", "Chargers, adapters, power supplies and inverters", "static converters", true),
  I("850110", "power", "Micro-motors (up to 37.5 W)", "motors"),
  I("850131", "power", "Small DC motors (up to 750 W)", "motors"),
  I("850132", "power", "DC motors, 750 W to 75 kW", "motors"),
  I("850152", "power", "Industrial AC motors, 750 W to 75 kW", "motors"),
  I("850300", "power", "Motor and generator parts", "parts"),
  I("850511", "power", "Rare-earth and other metal permanent magnets", "permanent magnets"),
  I("850519", "power", "Ferrite and other permanent magnets", "permanent magnets"),
  I("853710", "power", "Control panels and PLC boards (up to 1,000 V)", "1000"),
  I("853720", "power", "High-voltage switchgear panels", "1000"),
  I("853521", "power", "High-voltage circuit breakers", "circuit breakers"),
  I("850421", "power", "Distribution transformers (up to 650 kVA)", "transformers"),
  I("850423", "power", "Large power transformers (over 10 MVA)", "transformers"),
  I("854460", "power", "High-voltage cables", "conductors"),

  /* ── solar, wind, EVs & grid ───────────────────────────────────────── */
  I("854142", "energy", "Solar cells (not yet in panels)", "not assembled in modules"),
  I("854143", "energy", "Solar panels", "assembled in modules"),
  I("850172", "energy", "Solar DC generators (over 50 W)", "photovoltaic"),
  I("850180", "energy", "Solar AC generators", "photovoltaic"),
  I("850231", "energy", "Wind turbines", "wind"),
  I("870380", "energy", "Electric cars", "only electric motor"),
  I("870360", "energy", "Plug-in hybrid cars (petrol)", "plugging"),
  I("870340", "energy", "Self-charging hybrid cars (petrol)", "electric motor"),
  I("870240", "energy", "Electric buses", "only electric motor"),
  I("870460", "energy", "Electric trucks and vans", "only electric motor"),
  I("871160", "energy", "Electric motorcycles, scooters and e-bikes", "electric motor"),
  I("841861", "energy", "Heat pumps", "heat pumps"),
  I("841510", "energy", "Split and window air conditioners", "window"),
  I("853952", "energy", "LED lamps", "light-emitting"),
  I("853951", "energy", "LED modules", "light-emitting"),
  I("940542", "energy", "LED light fittings", "light-emitting"),
  I("940541", "energy", "Solar-powered light fittings", "photovoltaic"),
  I("902830", "energy", "Electricity meters", "electricity"),

  /* ── displays, TVs & lighting ──────────────────────────────────────── */
  I("852872", "display", "Televisions", "colour"),
  I("852852", "display", "Computer monitors", "capable of directly connecting"),
  I("852859", "display", "Other monitors", "monitors"),
  I("852862", "display", "Projectors for computers", "projectors"),
  I("852869", "display", "Other projectors", "projectors"),
  I("852411", "display", "LCD display modules (without drivers)", "liquid crystals"),
  I("852412", "display", "OLED display modules (without drivers)", "organic light-emitting"),
  I("852419", "display", "Other display modules (without drivers)", "flat panel display"),
  I("852491", "display", "LCD display modules (with drivers or touch)", "liquid crystals"),
  I("852492", "display", "OLED display modules (with drivers or touch)", "organic light-emitting"),
  I("852499", "display", "Other display modules (with drivers or touch)", "flat panel display"),
  I("901380", "display", "Other optical devices (incl. liquid-crystal devices)", "9013"),
  I("901390", "display", "Parts of LCD devices and lasers", "parts"),
  I("852990", "display", "Parts for TVs, cameras and radios (incl. modules)", "for use with"),
  I("852910", "display", "Aerials for TV and radio", "aerials"),

  /* ── cameras & optics ──────────────────────────────────────────────── */
  I("852589", "camera", "Digital, security, web and dash cameras", "television cameras"),
  I("852583", "camera", "Night-vision and thermal cameras", "night vision"),
  I("852581", "camera", "High-speed cameras", "high-speed"),
  I("852582", "camera", "Radiation-hardened cameras", "radiation"),
  I("900211", "camera", "Camera and projector objective lenses", "objective"),
  I("900219", "camera", "Other objective lenses (incl. phone lens stacks)", "objective"),
  I("900290", "camera", "Mounted lenses, prisms and filters", "mounted"),
  I("900190", "camera", "Unmounted lenses, prisms and mirrors", "unmounted"),
  I("900120", "camera", "Polarising sheets and plates", "polarising"),
  I("901320", "camera", "Lasers", "lasers"),
  I("900640", "camera", "Instant cameras", "instant print"),
  I("900659", "camera", "Other photographic cameras", "cameras"),
  I("900691", "camera", "Camera parts", "parts"),
  I("901310", "camera", "Telescopic sights", "telescopic sights"),
  I("900510", "camera", "Binoculars", "binoculars"),

  /* ── audio & music electronics ─────────────────────────────────────── */
  I("851810", "audio", "Microphones", "microphones"),
  I("851821", "audio", "Single speakers in enclosures", "single"),
  I("851822", "audio", "Multi-speaker systems (soundbars, party speakers)", "multiple"),
  I("851829", "audio", "Speaker drivers and other loudspeakers", "loudspeakers"),
  I("851830", "audio", "Headphones and earbuds", "headphones"),
  I("851840", "audio", "Audio amplifiers", "audio-frequency"),
  I("851850", "audio", "PA and sound-amplifier sets", "amplifier sets"),
  I("851890", "audio", "Audio parts", "parts"),
  I("851981", "audio", "Recorders and media players", "semiconductor media"),
  I("852713", "audio", "Portable radios with players", "radio"),
  I("852791", "audio", "Home radios with players", "radio"),
  I("852721", "audio", "Car radios with players", "motor vehicles"),
  I("920710", "audio", "Digital pianos and electronic keyboards", "keyboard"),
  I("920790", "audio", "Electric guitars and other electric instruments", "musical instruments"),

  /* ── networking, telecom & navigation ──────────────────────────────── */
  I("851761", "telecom", "Mobile base stations", "base stations"),
  I("851762", "telecom", "Routers, switches, modems, transceivers and smartwatches", "reception, conversion", true),
  I("851769", "telecom", "Other transmission apparatus", "apparatus"),
  I("851771", "telecom", "Antennas and reflectors for phones and networks", "aerials"),
  I("852550", "telecom", "Broadcast transmitters", "transmission apparatus"),
  I("852560", "telecom", "Walkie-talkies and radio transceivers", "incorporating reception"),
  I("852610", "telecom", "Radar", "radar"),
  I("852691", "telecom", "GPS and radio navigation receivers", "navigational"),
  I("852692", "telecom", "Radio remote controls", "remote control"),
  I("900110", "telecom", "Optical fibres", "optical fibres", true),

  /* ── drones, robots & motion ───────────────────────────────────────── */
  I("880621", "drones", "Drones up to 250 g", "unmanned aircraft"),
  I("880622", "drones", "Drones 250 g to 7 kg", "unmanned aircraft"),
  I("880623", "drones", "Drones 7 to 25 kg", "unmanned aircraft"),
  I("880624", "drones", "Drones 25 to 150 kg", "unmanned aircraft"),
  I("880629", "drones", "Heavier remote-controlled drones", "unmanned aircraft"),
  I("880692", "drones", "Autonomous drones 250 g to 7 kg", "unmanned aircraft"),
  I("880730", "drones", "Aircraft and drone parts", "unmanned aircraft"),
  I("847950", "drones", "Industrial robots", "robots"),
  I("848340", "drones", "Gears, gearboxes and ball screws", "gears"),
  I("848210", "drones", "Ball bearings", "ball bearings"),
  I("848250", "drones", "Cylindrical roller bearings", "cylindrical roller"),
  I("842710", "drones", "Electric forklifts", "electric motor"),
  I("901420", "drones", "Gyros and aeronautical navigation instruments", "aeronautical"),
  I("901480", "drones", "Other navigation instruments", "navigational"),

  /* ── machine tools & factory equipment ─────────────────────────────── */
  I("845710", "factory", "CNC machining centres", "machining centres"),
  I("845811", "factory", "CNC lathes", "numerically controlled"),
  I("845611", "factory", "Laser cutting and machining tools", "laser"),
  I("845630", "factory", "Electrical-discharge (EDM) machines", "electro-discharge"),
  I("846261", "factory", "Hydraulic presses", "hydraulic"),
  I("846262", "factory", "Mechanical presses", "mechanical"),
  I("846263", "factory", "Servo presses", "servo-presses"),
  I("847710", "factory", "Injection-moulding machines", "injection-moulding"),
  I("847720", "factory", "Plastics extruders", "extruders"),
  I("848071", "factory", "Injection and compression moulds", "injection or compression"),
  I("848510", "factory", "Metal 3D printers", "metal deposit"),
  I("848520", "factory", "Plastic 3D printers", "plastic or rubber"),
  I("851521", "factory", "Automatic resistance welders", "resistance welding"),
  I("851531", "factory", "Automatic arc welders", "arc"),
  I("851580", "factory", "Laser, ultrasonic and other welders", "welding"),
  I("847989", "factory", "Other special-purpose machines", "individual functions"),
  I("842833", "factory", "Belt conveyors", "belt"),
  I("841370", "factory", "Centrifugal pumps", "centrifugal"),
  I("841459", "factory", "Industrial and cooling fans", "fans", true),
  I("848180", "factory", "Valves, taps and solenoid valves", "valves"),

  /* ── instruments, sensors & control ────────────────────────────────── */
  I("903289", "instruments", "Automatic controllers and regulators", "regulating or controlling"),
  I("903180", "instruments", "Measuring and checking instruments (incl. sensors)", "measuring or checking"),
  I("903033", "instruments", "Multimeters and voltage/current meters", "voltage"),
  I("903020", "instruments", "Oscilloscopes", "oscilloscopes"),
  I("903040", "instruments", "Telecom test instruments", "telecommunication"),
  I("902610", "instruments", "Flow and level meters", "flow or level"),
  I("902620", "instruments", "Pressure gauges and sensors", "pressure"),
  I("902519", "instruments", "Electronic thermometers", "thermometers"),
  I("902750", "instruments", "Optical analysers and spectrophotometers", "optical radiations"),
  I("902780", "instruments", "Other laboratory analysers", "analysis"),
  I("901580", "instruments", "Surveying instruments", "surveying"),
  I("853110", "instruments", "Burglar and fire alarms", "burglar or fire"),
  I("854320", "instruments", "Signal generators", "signal generators"),

  /* ── home appliances & gadgets ─────────────────────────────────────── */
  I("851650", "home", "Microwave ovens", "microwave"),
  I("851660", "home", "Ovens, cookers and induction hobs", "ovens"),
  I("851671", "home", "Coffee and tea makers", "coffee or tea"),
  I("851679", "home", "Air fryers and other electric cooking appliances", "electro-thermic"),
  I("851631", "home", "Hair dryers", "hair dryers"),
  I("851640", "home", "Electric irons", "irons"),
  I("851610", "home", "Electric water heaters", "water"),
  I("851629", "home", "Electric space heaters", "space heating"),
  I("850811", "home", "Vacuum cleaners incl. robot vacuums (up to 1.5 kW)", "vacuum cleaners"),
  I("850940", "home", "Mixers, grinders and juicers", "food grinders"),
  I("850980", "home", "Other domestic appliances", "domestic appliances"),
  I("851010", "home", "Electric shavers", "shavers"),
  I("845011", "home", "Washing machines", "washing machines"),
  I("841821", "home", "Refrigerators", "refrigerators"),
  I("841451", "home", "Table, floor and ceiling fans", "fans"),
  I("950450", "home", "Video game consoles", "video game"),
  I("950300", "home", "Toys, including electronic and remote-controlled toys", "toys"),

  /* ── medical electronics ───────────────────────────────────────────── */
  I("901811", "medical", "ECG machines", "electro-cardiographs"),
  I("901812", "medical", "Ultrasound scanners", "ultrasonic"),
  I("901813", "medical", "MRI machines", "magnetic resonance"),
  I("901819", "medical", "Patient monitors and other electro-diagnostics", "electro-diagnostic"),
  I("902212", "medical", "CT scanners", "tomography"),
  I("902214", "medical", "Medical X-ray machines", "medical"),
  I("902140", "medical", "Hearing aids", "hearing aids"),
  I("902150", "medical", "Pacemakers", "pacemakers"),
  I("901920", "medical", "Ventilators and oxygen-therapy apparatus", "oxygen"),
  I("901910", "medical", "Massage apparatus", "massage"),
  I("901890", "medical", "Other medical instruments", "medical"),

  /* ── critical materials ────────────────────────────────────────────── */
  I("280530", "materials", "Rare-earth metals", "rare"),
  I("284690", "materials", "Rare-earth compounds", "rare-earth"),
  I("284610", "materials", "Cerium compounds", "cerium"),
  I("282520", "materials", "Lithium oxide and hydroxide", "lithium"),
  I("283691", "materials", "Lithium carbonate", "lithium"),
  I("282200", "materials", "Cobalt oxides", "cobalt"),
  I("380110", "materials", "Artificial graphite (battery anodes)", "graphite"),
  I("250410", "materials", "Natural graphite", "graphite"),
  I("740311", "materials", "Refined copper cathodes", "cathodes"),
  I("750210", "materials", "Unwrought nickel", "nickel"),
];

export const SECTOR_BY_ID = new Map(SECTORS.map((s) => [s.id, s]));
