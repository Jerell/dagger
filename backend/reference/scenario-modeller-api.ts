/* eslint-disable */
/* tslint:disable */
// @ts-nocheck
/*
 * ---------------------------------------------------------------
 * ## THIS FILE WAS GENERATED VIA SWAGGER-TYPESCRIPT-API        ##
 * ##                                                           ##
 * ## AUTHOR: acacode                                           ##
 * ## SOURCE: https://github.com/acacode/swagger-typescript-api ##
 * ---------------------------------------------------------------
 */

/**
 * Supported values: 0=NONE, 1=LOW, 2=HIGH
 * @format int32
 */
export enum LevelOfCorrosionPotential {
  Value0 = 0,
  Value1 = 1,
  Value2 = 2,
}

/**
 * Supported values: 0=NN (default), 1=FILES (not supported), 2=COOLPROP
 * @format int32
 */
export enum FluidFactoryType {
  Value0 = 0,
  Value1 = 1,
  Value2 = 2,
}

export enum ElementTypes {
  Compressor = "Compressor",
  CompressorTrain = "CompressorTrain",
  Cooler = "Cooler",
  Heater = "Heater",
  MergingManifold = "MergingManifold",
  Network = "Network",
  Perforation = "Perforation",
  PipeSeg = "PipeSeg",
  Probe = "Probe",
  Pump = "Pump",
  Reservoir = "Reservoir",
  Scavenger = "Scavenger",
  Sink = "Sink",
  Source = "Source",
  Splitter = "Splitter",
  Subnet = "Subnet",
  Valve = "Valve",
  Well = "Well",
}

export interface TemperatureRequest {
  $type: string;
}

export interface PressureRequest {
  $type: string;
}

export interface MixtureComponentRequest {
  $type: string;
}

export interface FlowrateRequest {
  $type: string;
}

export interface ChemicalReactionErrorResponse {
  error: ErrorModel;
}

export interface ChemicalReactionOkResponse {
  steps: ChemicalReactionStepResponse[];
  finalComposition: Record<string, MixtureComponent>;
}

export interface ChemicalReactionRequest {
  reactions: ReactionRequest[][];
  input: Record<
    string,
    | MixtureComponentRequestMolFraction
    | MixtureComponentRequestMolPercent
    | MixtureComponentRequestPpm
    | MixtureComponentRequestPpb
  >;
}

export interface ChemicalReactionStepResponse {
  reaction: ReactionResponse;
  /** @format double */
  reactionRatio: number;
  limitingReactant: string;
  output: Record<string, MixtureComponent>;
}

export interface CompositionRequest {
  ammonia?:
    | MixtureComponentRequestMolFraction
    | MixtureComponentRequestMolPercent
    | MixtureComponentRequestPpm
    | MixtureComponentRequestPpb;
  argon?:
    | MixtureComponentRequestMolFraction
    | MixtureComponentRequestMolPercent
    | MixtureComponentRequestPpm
    | MixtureComponentRequestPpb;
  benzene?:
    | MixtureComponentRequestMolFraction
    | MixtureComponentRequestMolPercent
    | MixtureComponentRequestPpm
    | MixtureComponentRequestPpb;
  carbonDioxide?:
    | MixtureComponentRequestMolFraction
    | MixtureComponentRequestMolPercent
    | MixtureComponentRequestPpm
    | MixtureComponentRequestPpb;
  carbonMonoxide?:
    | MixtureComponentRequestMolFraction
    | MixtureComponentRequestMolPercent
    | MixtureComponentRequestPpm
    | MixtureComponentRequestPpb;
  carbonylSulfide?:
    | MixtureComponentRequestMolFraction
    | MixtureComponentRequestMolPercent
    | MixtureComponentRequestPpm
    | MixtureComponentRequestPpb;
  chlorine?:
    | MixtureComponentRequestMolFraction
    | MixtureComponentRequestMolPercent
    | MixtureComponentRequestPpm
    | MixtureComponentRequestPpb;
  ethane?:
    | MixtureComponentRequestMolFraction
    | MixtureComponentRequestMolPercent
    | MixtureComponentRequestPpm
    | MixtureComponentRequestPpb;
  ethanol?:
    | MixtureComponentRequestMolFraction
    | MixtureComponentRequestMolPercent
    | MixtureComponentRequestPpm
    | MixtureComponentRequestPpb;
  hydrogen?:
    | MixtureComponentRequestMolFraction
    | MixtureComponentRequestMolPercent
    | MixtureComponentRequestPpm
    | MixtureComponentRequestPpb;
  hydrogenChloride?:
    | MixtureComponentRequestMolFraction
    | MixtureComponentRequestMolPercent
    | MixtureComponentRequestPpm
    | MixtureComponentRequestPpb;
  hydrogenSulfide?:
    | MixtureComponentRequestMolFraction
    | MixtureComponentRequestMolPercent
    | MixtureComponentRequestPpm
    | MixtureComponentRequestPpb;
  meg?:
    | MixtureComponentRequestMolFraction
    | MixtureComponentRequestMolPercent
    | MixtureComponentRequestPpm
    | MixtureComponentRequestPpb;
  methane?:
    | MixtureComponentRequestMolFraction
    | MixtureComponentRequestMolPercent
    | MixtureComponentRequestPpm
    | MixtureComponentRequestPpb;
  methanol?:
    | MixtureComponentRequestMolFraction
    | MixtureComponentRequestMolPercent
    | MixtureComponentRequestPpm
    | MixtureComponentRequestPpb;
  nitricAcid?:
    | MixtureComponentRequestMolFraction
    | MixtureComponentRequestMolPercent
    | MixtureComponentRequestPpm
    | MixtureComponentRequestPpb;
  nitrogen?:
    | MixtureComponentRequestMolFraction
    | MixtureComponentRequestMolPercent
    | MixtureComponentRequestPpm
    | MixtureComponentRequestPpb;
  nox?:
    | MixtureComponentRequestMolFraction
    | MixtureComponentRequestMolPercent
    | MixtureComponentRequestPpm
    | MixtureComponentRequestPpb;
  oxygen?:
    | MixtureComponentRequestMolFraction
    | MixtureComponentRequestMolPercent
    | MixtureComponentRequestPpm
    | MixtureComponentRequestPpb;
  propanol?:
    | MixtureComponentRequestMolFraction
    | MixtureComponentRequestMolPercent
    | MixtureComponentRequestPpm
    | MixtureComponentRequestPpb;
  sox?:
    | MixtureComponentRequestMolFraction
    | MixtureComponentRequestMolPercent
    | MixtureComponentRequestPpm
    | MixtureComponentRequestPpb;
  sulfuricAcid?:
    | MixtureComponentRequestMolFraction
    | MixtureComponentRequestMolPercent
    | MixtureComponentRequestPpm
    | MixtureComponentRequestPpb;
  sulfurousAcid?:
    | MixtureComponentRequestMolFraction
    | MixtureComponentRequestMolPercent
    | MixtureComponentRequestPpm
    | MixtureComponentRequestPpb;
  teg?:
    | MixtureComponentRequestMolFraction
    | MixtureComponentRequestMolPercent
    | MixtureComponentRequestPpm
    | MixtureComponentRequestPpb;
  water?:
    | MixtureComponentRequestMolFraction
    | MixtureComponentRequestMolPercent
    | MixtureComponentRequestPpm
    | MixtureComponentRequestPpb;
}

export interface CompositionResponse {
  ammonia?: MixtureComponent;
  argon?: MixtureComponent;
  benzene?: MixtureComponent;
  carbonDioxide?: MixtureComponent;
  carbonMonoxide?: MixtureComponent;
  carbonylSulfide?: MixtureComponent;
  chlorine?: MixtureComponent;
  ethane?: MixtureComponent;
  ethanol?: MixtureComponent;
  hydrogen?: MixtureComponent;
  hydrogenChloride?: MixtureComponent;
  hydrogenSulfide?: MixtureComponent;
  meg?: MixtureComponent;
  methane?: MixtureComponent;
  methanol?: MixtureComponent;
  nitricAcid?: MixtureComponent;
  nitrogen?: MixtureComponent;
  nOx?: MixtureComponent;
  oxygen?: MixtureComponent;
  propanol?: MixtureComponent;
  sOx?: MixtureComponent;
  sulfuricAcid?: MixtureComponent;
  sulfurousAcid?: MixtureComponent;
  teg?: MixtureComponent;
  water?: MixtureComponent;
  /** @format double */
  molarMassGPerMol?: number;
}

export interface CompressorAttributes {
  isEnabled: boolean;
  maximumOutletPressure:
    | PressureRequestBara
    | PressureRequestBarg
    | PressureRequestPascal
    | PressureRequestPsi
    | PressureRequestPsf;
  maximumOperatingTemperature:
    | TemperatureRequestCelsius
    | TemperatureRequestKelvin;
  minimumUpstreamPressure:
    | PressureRequestBara
    | PressureRequestBarg
    | PressureRequestPascal
    | PressureRequestPsi
    | PressureRequestPsf;
  /** @format double */
  isentropicEfficiency: number;
}

export interface Conditions {
  network: NetworkAttributes;
  emitter1: InletAttributes;
  emitter2: InletAttributes;
  emitter3: InletAttributes;
  emitterStorage?: InletAttributes;
  /** @format int32 */
  numberOfCompressionStages?: number;
  compressor1: CompressorAttributes;
  cooler1: CoolerAttributes;
  wellheadHeater1: HeaterAttributes;
  wellheadValve1: ValveAttributes;
  well1: WellAttributes;
  reservoir1: ReservoirAttributes;
  wellheadHeater2: HeaterAttributes;
  wellheadValve2: ValveAttributes;
  well2: WellAttributes;
  reservoir2: ReservoirAttributes;
}

export interface CoolerAttributes {
  isEnabled: boolean;
  outletTemperature: TemperatureRequestCelsius | TemperatureRequestKelvin;
  pressureDelta:
    | PressureRequestBara
    | PressureRequestBarg
    | PressureRequestPascal
    | PressureRequestPsi
    | PressureRequestPsf;
  /** @format double */
  isentropicEfficiency: number;
}

export interface CorrosionResult {
  name: string;
  kind: string;
  fluidId: string;
  scenarioFluidId: string;
  pointId?: string | null;
  pathId?: string | null;
  material: Material;
}

export interface Density {
  /** @format double */
  kgPerM3: number;
  /** @format double */
  lbPerFt3: number;
}

export interface Display {
  name: string;
  anchor?: string | null;
  textOffset?: XyPair;
}

export interface Enthalpy {
  /** @format double */
  jPerKg: number;
  /** @format double */
  kjPerKg: number;
}

export interface Entropy {
  /** @format double */
  jPerK: number;
  /** @format double */
  kjPerK: number;
}

export interface ErrorModel {
  type?: string | null;
  message?: string | null;
  severity?: string | null;
  errorCode?: string | null;
  metaData?: Record<string, any>;
}

export interface FeatureFlags {
  /** Supported values: 0=NN (default), 1=FILES (not supported), 2=COOLPROP */
  fluidFactoryType?: FluidFactoryType;
  useCoolProp?: boolean;
}

export interface Flowrate {
  /** @format double */
  kgps: number;
  /** @format double */
  mtpa: number;
  /** @format double */
  kgPerDay: number;
  /** @format double */
  tonnePerHour: number;
}

export type FlowrateRequestKgPerDay = FlowrateRequest & {
  /** @format double */
  kgPerDay: number;
};

export type FlowrateRequestKgps = FlowrateRequest & {
  /** @format double */
  kgps: number;
};

export type FlowrateRequestMtpa = FlowrateRequest & {
  /** @format double */
  mtpa: number;
};

export type FlowrateRequestTonnePerHour = FlowrateRequest & {
  /** @format double */
  tonnePerHour: number;
};

export interface FluidResponse {
  pressure?: Pressure;
  temperature?: Temperature;
  flowrate?: Flowrate;
  volumetricFlowrate?: VolumetricFlowrate;
  viscosity?: Viscosity;
  density?: Density;
  enthalpy?: Enthalpy;
  entropy?: Entropy;
  /** @format double */
  gasFraction?: number;
  composition?: CompositionResponse;
  molarVolume?: MolarVolume;
}

export interface FluidResult {
  fluidId: string;
  name: string;
  type: string;
}

export interface HeaterAttributes {
  isEnabled: boolean;
  outletTemperature: TemperatureRequestCelsius | TemperatureRequestKelvin;
  pressureDelta:
    | PressureRequestBara
    | PressureRequestBarg
    | PressureRequestPascal
    | PressureRequestPsi
    | PressureRequestPsf;
  /** @format double */
  isentropicEfficiency: number;
}

export interface InletAttributes {
  isEnabled: boolean;
  flowrate:
    | FlowrateRequestKgPerDay
    | FlowrateRequestKgps
    | FlowrateRequestMtpa
    | FlowrateRequestTonnePerHour;
  temperature: TemperatureRequestCelsius | TemperatureRequestKelvin;
  pressure:
    | PressureRequestBara
    | PressureRequestBarg
    | PressureRequestPascal
    | PressureRequestPsi
    | PressureRequestPsf;
  composition?: CompositionRequest;
}

export interface InputComponent {
  id: string;
  type: ElementTypes;
  location: string;
  displayName: string;
  compareFluid: string;
  externalId?: string | null;
}

export interface LatLong {
  /** @format double */
  latitude: number;
  /** @format double */
  longitude: number;
}

export interface MapConfig {
  /** @format double */
  scaleFactor: number;
  center: number[];
  viewBox: string;
}

export interface Material {
  name: string;
  isSusceptibleToWater: boolean;
  isSusceptibleToStrongAcids: boolean;
  isSusceptibleToSolids: boolean;
}

export interface MergingManifoldResponse {
  name?: string | null;
  transportElementType?: string | null;
  inFluids?: Record<string, FluidResponse>;
  outFluid?: FluidResponse;
}

export interface MixtureComponent {
  /** @format double */
  molFraction: number;
  /** @format double */
  molPercent: number;
}

export type MixtureComponentRequestMolFraction = MixtureComponentRequest & {
  /** @format double */
  molFraction: number;
};

export type MixtureComponentRequestMolPercent = MixtureComponentRequest & {
  /** @format double */
  molPercent: number;
};

export type MixtureComponentRequestPpb = MixtureComponentRequest & {
  /** @format double */
  ppb: number;
};

export type MixtureComponentRequestPpm = MixtureComponentRequest & {
  /** @format double */
  ppm: number;
};

export interface MolarVolume {
  /** @format double */
  m3PerMol: number;
  /** @format double */
  m3PerKMol: number;
}

export interface NetworkAttributes {
  airTemperature: TemperatureRequestCelsius | TemperatureRequestKelvin;
  soilTemperature: TemperatureRequestCelsius | TemperatureRequestKelvin;
  waterTemperature: TemperatureRequestCelsius | TemperatureRequestKelvin;
}

export interface NetworkPresentation {
  mapConfig: MapConfig;
  points: Point[];
  paths: Path[];
  inputComponents: InputComponent[];
  fluidResults: FluidResult[];
  corrosionResults: CorrosionResult[];
  virtualMeters: VirtualMeter[];
  thresholds: Threshold[];
}

export interface NetworkStructure {
  subnets?: Record<string, SubnetStructure>;
  componentYamlFilenames?: string[];
}

export interface Path {
  id: string;
  nodes: PathNode[];
}

export interface PathNode {
  location?: string | null;
  latLong?: number[] | null;
}

export interface Point {
  id: string;
  display?: Display;
  location?: LatLong;
}

export interface Power {
  /** @format double */
  watts: number;
  /** @format double */
  kiloWatts: number;
  /** @format double */
  joulesPerSecond: number;
}

export interface Pressure {
  /** @format double */
  pascal: number;
  /** @format double */
  bara: number;
  /** @format double */
  psi: number;
  /** @format double */
  barg: number;
  /** @format double */
  psf: number;
}

export type PressureRequestBara = PressureRequest & {
  /** @format double */
  bara: number;
};

export type PressureRequestBarg = PressureRequest & {
  /** @format double */
  barg: number;
};

export type PressureRequestPascal = PressureRequest & {
  /** @format double */
  pascal: number;
};

export type PressureRequestPsf = PressureRequest & {
  /** @format double */
  psf: number;
};

export type PressureRequestPsi = PressureRequest & {
  /** @format double */
  psi: number;
};

export interface ReactionRequest {
  input: Record<
    string,
    | MixtureComponentRequestMolFraction
    | MixtureComponentRequestMolPercent
    | MixtureComponentRequestPpm
    | MixtureComponentRequestPpb
  >;
  output: Record<
    string,
    | MixtureComponentRequestMolFraction
    | MixtureComponentRequestMolPercent
    | MixtureComponentRequestPpm
    | MixtureComponentRequestPpb
  >;
}

export interface ReactionResponse {
  input: Record<string, MixtureComponent>;
  output: Record<string, MixtureComponent>;
}

export interface ReservoirAttributes {
  isEnabled: boolean;
  pressure:
    | PressureRequestBara
    | PressureRequestBarg
    | PressureRequestPascal
    | PressureRequestPsi
    | PressureRequestPsf;
}

export interface ScenarioDescription {
  networkPresentation?: NetworkPresentation;
  networkStructure?: NetworkStructure;
}

export interface ScenarioDescriptionFailResponse {
  error?: ErrorModel;
}

export interface ScenarioDescriptionOkResponse {
  error?: ErrorModel;
  scenarioDescription: ScenarioDescription;
}

export interface ScenarioFailResponse {
  error?: ErrorModel;
  report?: string;
}

export interface ScenarioOkResponse {
  error?: ErrorModel;
  data?: Record<string, any>;
  metadata?: Record<string, any>;
  report?: string;
  thresholds?: ThresholdsResponse;
}

export interface ScenarioRequest {
  conditions: Record<string, any>;
  structure?: NetworkStructure;
  includeAllPipes?: boolean;
}

export interface SnapshotFailResponse {
  error?: ErrorModel;
  report?: string | null;
}

export interface SnapshotOkResponse {
  error?: ErrorModel;
  emitter1?: TransportElementResponse;
  emitter2?: TransportElementResponse;
  emitter3?: TransportElementResponse;
  mergingManifold1?: MergingManifoldResponse;
  mergingManifold2?: MergingManifoldResponse;
  mergingManifold3?: MergingManifoldResponse;
  compressor1?: WorkElementResponse;
  cooler1?: WorkElementResponse;
  splitter1?: SplitterResponse;
  emitterStorage?: TransportElementResponse;
  pumpStorage?: WorkElementResponse;
  coolerStorage?: WorkElementResponse;
  wellheadHeater1?: WorkElementResponse;
  wellheadValve1?: TransformElementResponse;
  well1?: TransportElementResponse;
  perforation1?: TransportElementResponse;
  reservoir1?: TransportElementResponse;
  wellheadHeater2?: WorkElementResponse;
  wellheadValve2?: TransformElementResponse;
  well2?: TransportElementResponse;
  perforation2?: TransportElementResponse;
  reservoir2?: TransportElementResponse;
  thresholds?: ThresholdsResponse;
  subnetPipeSegments?: Record<string, TransportElementResponse[] | null>;
  report?: string | null;
}

export interface SnapshotRequest {
  conditions: Conditions;
  includeAllPipes?: boolean;
}

export interface SplitterResponse {
  name?: string | null;
  transportElementType?: string | null;
  inFluid?: FluidResponse;
  outFluids?: Record<string, FluidResponse>;
}

export interface SubnetStructure {
  subnetName?: string;
  downstreamSubnetName?: string;
  componentSeriesMap?: Record<string, string[]>;
}

export interface Temperature {
  /** @format double */
  kelvin: number;
  /** @format double */
  celsius: number;
}

export type TemperatureRequestCelsius = TemperatureRequest & {
  /** @format double */
  celsius: number;
};

export type TemperatureRequestKelvin = TemperatureRequest & {
  /** @format double */
  kelvin: number;
};

export interface Threshold {
  adviceId: string;
  propertyId: string;
  /** @format double */
  minThreshold: number | null;
  /** @format double */
  maxThreshold: number | null;
}

export interface ThresholdsResponse {
  maxWaterContentInPipeline?: MixtureComponent;
  minTemperatureInPipeline?: Temperature;
  maxPressureInOffshorePipeline?: Pressure;
  maxPressureInOnshore?: Pressure;
  temperatureInWell?: Temperature;
  /** Supported values: 0=NONE, 1=LOW, 2=HIGH */
  corrosionPotential?: LevelOfCorrosionPotential;
}

export interface TransformElementResponse {
  name?: string | null;
  transportElementType?: string | null;
  inFluid?: FluidResponse;
  outFluid?: FluidResponse;
}

export interface TransportElementResponse {
  name?: string | null;
  transportElementType?: string | null;
  inFluid?: FluidResponse;
}

export interface ValveAttributes {
  minimumUpstreamPressure:
    | PressureRequestBara
    | PressureRequestBarg
    | PressureRequestPascal
    | PressureRequestPsi
    | PressureRequestPsf;
}

export interface VirtualMeter {
  id: string;
  pointId: string;
  fluidId: string;
}

export interface Viscosity {
  /** @format double */
  pascalSecond: number;
}

export interface VolumetricFlowrate {
  /** @format double */
  m3PerS: number;
  /** @format double */
  m3PerH?: number;
}

export interface WaterDropoutErrorResponse {
  error: ErrorModel;
}

export interface WaterDropoutOkResponse {
  hasWaterDropoutRisk: boolean;
}

export interface WaterDropoutRequest {
  temperature: TemperatureRequestCelsius | TemperatureRequestKelvin;
  pressure:
    | PressureRequestBara
    | PressureRequestBarg
    | PressureRequestPascal
    | PressureRequestPsi
    | PressureRequestPsf;
  composition: CompositionRequest;
}

export interface WellAttributes {
  /** @format int32 */
  numberOfSplits: number;
}

export interface WorkElementResponse {
  name?: string | null;
  transportElementType?: string | null;
  inFluid?: FluidResponse;
  outFluid?: FluidResponse;
  isEnabled?: boolean;
  workDone?: Power;
  duty?: Power;
}

export interface XyPair {
  /** @format double */
  x: number;
  /** @format double */
  y: number;
}

export type QueryParamsType = Record<string | number, any>;
export type ResponseFormat = keyof Omit<Body, 'body' | 'bodyUsed'>;

export interface FullRequestParams extends Omit<RequestInit, 'body'> {
  /** set parameter to `true` for call `securityWorker` for this request */
  secure?: boolean;
  /** request path */
  path: string;
  /** content type of request body */
  type?: ContentType;
  /** query params */
  query?: QueryParamsType;
  /** format of response (i.e. response.json() -> format: "json") */
  format?: ResponseFormat;
  /** request body */
  body?: unknown;
  /** base url */
  baseUrl?: string;
  /** request cancellation token */
  cancelToken?: CancelToken;
}

export type RequestParams = Omit<
  FullRequestParams,
  'body' | 'method' | 'query' | 'path'
>;

export interface ApiConfig<SecurityDataType = unknown> {
  baseUrl?: string;
  baseApiParams?: Omit<RequestParams, 'baseUrl' | 'cancelToken' | 'signal'>;
  securityWorker?: (
    securityData: SecurityDataType | null,
  ) => Promise<RequestParams | void> | RequestParams | void;
  customFetch?: typeof fetch;
}

export interface HttpResponse<D extends unknown, E extends unknown = unknown>
  extends Response {
  data: D;
  error: E;
}

type CancelToken = Symbol | string | number;

export enum ContentType {
  Json = 'application/json',
  JsonApi = 'application/vnd.api+json',
  FormData = 'multipart/form-data',
  UrlEncoded = 'application/x-www-form-urlencoded',
  Text = 'text/plain',
}

export class HttpClient<SecurityDataType = unknown> {
  public baseUrl: string = '';
  private securityData: SecurityDataType | null = null;
  private securityWorker?: ApiConfig<SecurityDataType>['securityWorker'];
  private abortControllers = new Map<CancelToken, AbortController>();
  private customFetch = (...fetchParams: Parameters<typeof fetch>) =>
    fetch(...fetchParams);

  private baseApiParams: RequestParams = {
    credentials: 'same-origin',
    headers: {},
    redirect: 'follow',
    referrerPolicy: 'no-referrer',
  };

  constructor(apiConfig: ApiConfig<SecurityDataType> = {}) {
    Object.assign(this, apiConfig);
  }

  public setSecurityData = (data: SecurityDataType | null) => {
    this.securityData = data;
  };

  protected encodeQueryParam(key: string, value: any) {
    const encodedKey = encodeURIComponent(key);
    return `${encodedKey}=${encodeURIComponent(typeof value === 'number' ? value : `${value}`)}`;
  }

  protected addQueryParam(query: QueryParamsType, key: string) {
    return this.encodeQueryParam(key, query[key]);
  }

  protected addArrayQueryParam(query: QueryParamsType, key: string) {
    const value = query[key];
    return value.map((v: any) => this.encodeQueryParam(key, v)).join('&');
  }

  protected toQueryString(rawQuery?: QueryParamsType): string {
    const query = rawQuery || {};
    const keys = Object.keys(query).filter(
      (key) => 'undefined' !== typeof query[key],
    );
    return keys
      .map((key) =>
        Array.isArray(query[key])
          ? this.addArrayQueryParam(query, key)
          : this.addQueryParam(query, key),
      )
      .join('&');
  }

  protected addQueryParams(rawQuery?: QueryParamsType): string {
    const queryString = this.toQueryString(rawQuery);
    return queryString ? `?${queryString}` : '';
  }

  private contentFormatters: Record<ContentType, (input: any) => any> = {
    [ContentType.Json]: (input: any) =>
      input !== null && (typeof input === 'object' || typeof input === 'string')
        ? JSON.stringify(input)
        : input,
    [ContentType.JsonApi]: (input: any) =>
      input !== null && (typeof input === 'object' || typeof input === 'string')
        ? JSON.stringify(input)
        : input,
    [ContentType.Text]: (input: any) =>
      input !== null && typeof input !== 'string'
        ? JSON.stringify(input)
        : input,
    [ContentType.FormData]: (input: any) => {
      if (input instanceof FormData) {
        return input;
      }

      return Object.keys(input || {}).reduce((formData, key) => {
        const property = input[key];
        formData.append(
          key,
          property instanceof Blob
            ? property
            : typeof property === 'object' && property !== null
              ? JSON.stringify(property)
              : `${property}`,
        );
        return formData;
      }, new FormData());
    },
    [ContentType.UrlEncoded]: (input: any) => this.toQueryString(input),
  };

  protected mergeRequestParams(
    params1: RequestParams,
    params2?: RequestParams,
  ): RequestParams {
    return {
      ...this.baseApiParams,
      ...params1,
      ...(params2 || {}),
      headers: {
        ...(this.baseApiParams.headers || {}),
        ...(params1.headers || {}),
        ...((params2 && params2.headers) || {}),
      },
    };
  }

  protected createAbortSignal = (
    cancelToken: CancelToken,
  ): AbortSignal | undefined => {
    if (this.abortControllers.has(cancelToken)) {
      const abortController = this.abortControllers.get(cancelToken);
      if (abortController) {
        return abortController.signal;
      }
      return void 0;
    }

    const abortController = new AbortController();
    this.abortControllers.set(cancelToken, abortController);
    return abortController.signal;
  };

  public abortRequest = (cancelToken: CancelToken) => {
    const abortController = this.abortControllers.get(cancelToken);

    if (abortController) {
      abortController.abort();
      this.abortControllers.delete(cancelToken);
    }
  };

  public request = async <T = any, E = any>({
    body,
    secure,
    path,
    type,
    query,
    format,
    baseUrl,
    cancelToken,
    ...params
  }: FullRequestParams): Promise<HttpResponse<T, E>> => {
    const secureParams =
      ((typeof secure === 'boolean' ? secure : this.baseApiParams.secure) &&
        this.securityWorker &&
        (await this.securityWorker(this.securityData))) ||
      {};
    const requestParams = this.mergeRequestParams(params, secureParams);
    const queryString = query && this.toQueryString(query);
    const payloadFormatter = this.contentFormatters[type || ContentType.Json];
    const responseFormat = format || requestParams.format;

    return this.customFetch(
      `${baseUrl || this.baseUrl || ''}${path}${queryString ? `?${queryString}` : ''}`,
      {
        ...requestParams,
        headers: {
          ...(requestParams.headers || {}),
          ...(type && type !== ContentType.FormData
            ? { 'Content-Type': type }
            : {}),
        },
        signal:
          (cancelToken
            ? this.createAbortSignal(cancelToken)
            : requestParams.signal) || null,
        body:
          typeof body === 'undefined' || body === null
            ? null
            : payloadFormatter(body),
      },
    ).then(async (response) => {
      const r = response as HttpResponse<T, E>;
      r.data = null as unknown as T;
      r.error = null as unknown as E;

      const responseToParse = responseFormat ? response.clone() : response;
      const data = !responseFormat
        ? r
        : await responseToParse[responseFormat]()
            .then((data) => {
              if (r.ok) {
                r.data = data;
              } else {
                r.error = data;
              }
              return r;
            })
            .catch((e) => {
              r.error = e;
              return r;
            });

      if (cancelToken) {
        this.abortControllers.delete(cancelToken);
      }

      if (!response.ok) throw data;
      return data;
    });
  };
}

/**
 * @title ScenarioModellerApi, Version=1.0.0.0, Culture=neutral, PublicKeyToken=null
 * @version 1.0
 */
export class Api<
  SecurityDataType extends unknown,
> extends HttpClient<SecurityDataType> {
  api = {
    /**
     * No description
     *
     * @tags ChemicalReaction
     * @name ChemicalReactionCreate
     * @request POST:/api/ChemicalReaction
     */
    chemicalReactionCreate: (
      data: ChemicalReactionRequest,
      params: RequestParams = {},
    ) =>
      this.request<ChemicalReactionOkResponse, ChemicalReactionErrorResponse>({
        path: `/api/ChemicalReaction`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Scenario
     * @name ScenarioCreate
     * @request POST:/api/Scenario
     */
    scenarioCreate: (data: ScenarioRequest, params: RequestParams = {}) =>
      this.request<ScenarioOkResponse, ScenarioFailResponse>({
        path: `/api/Scenario`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags ScenarioDescription
     * @name ScenarioDescriptionCreate
     * @request POST:/api/ScenarioDescription
     */
    scenarioDescriptionCreate: (params: RequestParams = {}) =>
      this.request<
        ScenarioDescriptionOkResponse,
        ScenarioDescriptionFailResponse
      >({
        path: `/api/ScenarioDescription`,
        method: 'POST',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Snapshot
     * @name SnapshotCreate
     * @request POST:/api/Snapshot
     */
    snapshotCreate: (data: SnapshotRequest, params: RequestParams = {}) =>
      this.request<SnapshotOkResponse, SnapshotFailResponse>({
        path: `/api/Snapshot`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags WaterDropout
     * @name WaterDropoutCreate
     * @request POST:/api/WaterDropout
     */
    waterDropoutCreate: (
      data: WaterDropoutRequest,
      params: RequestParams = {},
    ) =>
      this.request<WaterDropoutOkResponse, WaterDropoutErrorResponse>({
        path: `/api/WaterDropout`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        ...params,
      }),
  };
}
