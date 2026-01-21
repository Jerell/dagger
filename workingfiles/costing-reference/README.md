# Costing Reference Network

This network configuration matches the full chain from the costing tool's end-to-end tests (`costing.spec.ts`). It serves as a reference for integration testing the costing adapter.

## Chain Structure

```
Source → Capture → LP Compression → Dehydration → HP Compression → Refrigeration → Shipping → FISU → Injection Topsides → Injection Well
```

## Modules

| Branch | Block Type | Cost Library Module | Key Parameters |
|--------|-----------|---------------------|----------------|
| source | Emitter (cement) | Emitter/Cement | mass_flow: 100 |
| capture | CaptureUnit (amine) | CaptureUnit/Amine | mass_flow: 100, quantity: 3 |
| lp-compression | Compressor (lp, electric) | LpCompression/Electric Drive | compressor_duty: 100, cooling_duty: 100, quantity: 2 |
| dehydration | Dehydration (molecular_sieve) | Dehydration/Molecular Sieve | mass_flow_co2: 100 |
| hp-compression | Compressor (hp, electric) | HpCompression/Electric Drive | compressor_duty: 100, cooling_duty: 100 |
| refrigeration | Refrigeration (ep, water) | Refrigeration/EP - Water Cooling | heat_duty: 100, cooling_water: 100 |
| shipping | Shipping (ep) | Shipping/EP | (no parameters) |
| fisu | OffshorePlatform (fisu) | FloatingStorageAndInjectionUnit | number_of_fisu_vessels: 100 |
| injection-topsides | InjectionTopsides (offshore) | PlatformFsiuInjection | pump_motor_rating: 100, pump_flowrate: 100, heater_duty: 100 |
| injection-well | InjectionWell (offshore) | OffshoreInjectionWell | number_of_wells: 100 |

## Expected Results (EUR, V1.1_working library)

From `costing.spec.ts`:

- **Direct Equipment Cost**: €8,501,698,415.04
- **Total Installed Cost**: €31,881,369,056.40

## Item-Specific Parameters

Some cost library modules have multiple cost items with the same parameter name. These are disambiguated using item-specific suffixes:

### Compressor (LP/HP)
- `electrical_power_compressor` → Item 007 (compressor motor)
- `electrical_power_cooler` → Item 008 (after-cooler fans)

### InjectionTopsides
- `electrical_power_pump` → Item 028 (injection pump)
- `electrical_power_heater` → Item 006 (heater)

## Usage

This network can be loaded via:
- File path: `workingfiles/costing-reference`
- Or as inline `NetworkData` in tests

See `backend/src/services/costing/adapter.integration.test.ts` for test examples.
