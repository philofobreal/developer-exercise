export declare const validateV2: typeof validate20;
declare function validate20(data: any, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors }?: {
    instancePath?: string | undefined;
    rootData?: any;
    dynamicAnchors?: {} | undefined;
}): boolean;
declare namespace validate20 {
    var evaluated: {
        props: boolean;
        dynamicProps: boolean;
        dynamicItems: boolean;
    };
}
export declare const validateIR: typeof validate21;
declare function validate21(data: any, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors }?: {
    instancePath?: string | undefined;
    rootData?: any;
    dynamicAnchors?: {} | undefined;
}): boolean;
declare namespace validate21 {
    var evaluated: {
        props: boolean;
        dynamicProps: boolean;
        dynamicItems: boolean;
    };
}
export declare const validateV3: typeof validate38;
declare function validate38(data: any, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors }?: {
    instancePath?: string | undefined;
    rootData?: any;
    dynamicAnchors?: {} | undefined;
}): boolean;
declare namespace validate38 {
    var evaluated: {
        props: boolean;
        dynamicProps: boolean;
        dynamicItems: boolean;
    };
}
export default validateV2;
