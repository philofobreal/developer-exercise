export declare const validate: typeof validate20;
export default validate20;
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
