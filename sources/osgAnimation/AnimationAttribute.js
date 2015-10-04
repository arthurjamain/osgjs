define( [
    'osg/Map',
    'osg/Utils',
    'osg/StateAttribute',
    'osg/Uniform'
], function ( Map, MACROUTILS, StateAttribute, Uniform ) {

    'use strict';

    /**
     * AnimationAttribute encapsulate Animation State
     * @class AnimationAttribute
     * @inherits StateAttribute
     */
    var AnimationAttribute = function ( disable, boneUniformSize ) {
        StateAttribute.call( this );
        this._enable = !disable;
        // optional, if it's not provided, it will fall back to the maximum bone uniform size
        // boneUniformSize represents the number of vec4 (uniform) used in the shader for all the bones
        this._boneUniformSize = boneUniformSize;
    };

    AnimationAttribute.uniforms = {};
    AnimationAttribute.maxBoneUniformSize = 1;
    AnimationAttribute.maxBoneUniformAllowed = Infinity; // can be overriden by application specific limit on startup (typically gl limit)

    AnimationAttribute.prototype = MACROUTILS.objectLibraryClass( MACROUTILS.objectInherit( StateAttribute.prototype, {

        attributeType: 'AnimationAttribute',
        cloneType: function () {
            return new AnimationAttribute( true, this._boneUniformSize );
        },
        setBoneUniformSize: function ( boneUniformSize ) {
            this._boneUniformSize = boneUniformSize;
        },
        getBoneUniformSize: function () {
            return this._boneUniformSize !== undefined ? this._boneUniformSize : AnimationAttribute.maxBoneUniformSize;
        },

        getTypeMember: function () {
            return this.attributeType + '_' + this.getBoneUniformSize();
        },

        getOrCreateUniforms: function () {
            // uniform are once per CLASS attribute, not per instance
            var obj = AnimationAttribute;
            var typeMember = this.getTypeMember();

            if ( obj.uniforms[ typeMember ] ) return obj.uniforms[ typeMember ];

            var uniforms = {};

            uniforms[ 'uBones' ] = new Uniform.createFloat4Array( [], 'uBones' );
            obj.uniforms[ typeMember ] = new Map( uniforms );

            return obj.uniforms[ typeMember ];
        },
        setMatrixPalette: function ( matrixPalette ) {
            this._matrixPalette = matrixPalette;
            // update max bone size
            if ( this._boneUniformSize === undefined ) {
                AnimationAttribute.maxBoneUniformSize = Math.max( AnimationAttribute.maxBoneUniformSize, matrixPalette.length / 4 );
                AnimationAttribute.maxBoneUniformSize = Math.min( AnimationAttribute.maxBoneUniformAllowed, AnimationAttribute.maxBoneUniformSize );
            }
        },
        getMatrixPalette: function () {
            return this._matrixPalette;
        },
        // need a isEnabled to let the ShaderGenerator to filter
        // StateAttribute from the shader compilation
        isEnabled: function () {
            return this._enable;
        },
        getHashString: function () {
            // bonesize is important, as the shader itself
            // has a different code and uniform are not shared
            // geoms have each their own bones matrix palette
            // it's up to rigGeometry to use same anim Attrib per
            // same bone matrix palette
            // as uniform array size must be statically declared
            // in shader code
            return this.getTypeMember() + this.isEnabled();
        },

        apply: function () {
            if ( !this._enable )
                return;

            var uniformMap = this.getOrCreateUniforms();
            uniformMap.uBones.glData = uniformMap.uBones.data = this._matrixPalette; // hack to avoid copy

            this.setDirty( false );
        }

    } ), 'osgShadow', 'AnimationAttribute' );

    MACROUTILS.setTypeID( AnimationAttribute );

    return AnimationAttribute;
} );
