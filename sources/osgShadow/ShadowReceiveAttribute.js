define( [
    'osg/Utils',
    'osg/StateAttribute',
    'osg/Texture',
    'osg/Uniform',
    'osg/Matrix',
    'osg/Vec3',
    'osg/Vec4',
    'osg/Map',
    'osg/Notify'
], function ( MACROUTILS, StateAttribute, Texture, Uniform, Matrix, Vec3, Vec4, Map, Notify ) {
    'use strict';


    /**
     * ShadowReceiveAttribute encapsulate Shadow Main State object
     * @class ShadowReceiveAttribute
     * @inherits StateAttribute
     */
    var ShadowReceiveAttribute = function ( lightNum, disable ) {
        StateAttribute.call( this );

        this._lightNumber = lightNum;


        // see shadowSettings.js header for shadow algo param explanations
        // hash change var
        this._algoType = 'NONE';

        // shadow depth bias as projected in shadow camera space texture
        // and viewer camera space projection introduce its bias
        this._bias = 0.001;
        // algo dependant
        // Exponential shadow maps use exponential
        // to allows fuzzy depth
        this._exponent0 = 0.001;
        this._exponent1 = 0.001;
        // Variance Shadow mapping use One more epsilon
        this._epsilonVSM = 0.001;
        // shader compilation different upon texture precision
        this._precision = 'UNSIGNED_BYTE';
        // kernel size & type for pcf
        this._kernelSizePCF = undefined;

        this._fakePCF = true;

        this._rotateOffset = false;

        this._enable = !disable;

    };

    ShadowReceiveAttribute.uniforms = {};
    ShadowReceiveAttribute.prototype = MACROUTILS.objectLibraryClass( MACROUTILS.objectInherit( StateAttribute.prototype, {

        attributeType: 'ShadowReceive',

        cloneType: function () {
            return new ShadowReceiveAttribute( this._lightNumber, true );
        },

        getTypeMember: function () {
            return this.attributeType + this.getLightNumber();
        },
        getLightNumber: function () {
            return this._lightNumber;
        },

        getUniformName: function ( name ) {
            var prefix = this.getType() + this.getLightNumber().toString();
            return prefix + '_uniform_' + name;
        },
        getRotateOffset: function () {
            return this._rotateOffset;
        },
        setRotateOffset: function ( v ) {
            this._rotateOffset = v;
        },
        setAlgorithm: function ( algo ) {
            this._algoType = algo;
        },
        getAlgorithm: function () {
            return this._algoType;
        },

        setBias: function ( bias ) {
            this._bias = bias;
        },
        getBias: function () {
            return this._bias;
        },
        setExponent0: function ( exp ) {
            this._exponent0 = exp;
        },
        getExponent0: function () {
            return this._exponent0;
        },
        setExponent1: function ( exp ) {
            this._exponent1 = exp;
        },
        getExponent1: function () {
            return this._exponent1;
        },
        setEpsilonVSM: function ( epsilon ) {
            this._epsilonVSM = epsilon;
        },
        getEpsilonVSM: function () {
            return this._epsilonVSM;
        },
        getKernelSizePCF: function () {
            return this._kernelSizePCF;
        },
        setKernelSizePCF: function ( v ) {
            this._kernelSizePCF = v;
        },
        getFakePCF: function () {
            return this._fakePCF;
        },
        setFakePCF: function ( v ) {
            this._fakePCF = v;
        },
        setPrecision: function ( precision ) {
            this._precision = precision;
            this.dirty();
        },
        getPrecision: function () {
            return this._precision;
        },

        setLightNumber: function ( lightNum ) {
            this._lightNumber = lightNum;
            this.dirty();
        },

        getOrCreateUniforms: function () {
            // uniform are once per CLASS attribute, not per instance
            var obj = ShadowReceiveAttribute;

            var typeMember = this.getTypeMember();

            if ( obj.uniforms[ typeMember ] ) return obj.uniforms[ typeMember ];

            // Variance Shadow mapping use One more epsilon
            var uniformList = {
                'bias': 'createFloat',
                'exponent0': 'createFloat',
                'exponent1': 'createFloat',
                'epsilonVSM': 'createFloat'
            };

            var uniforms = {};

            Object.keys( uniformList ).forEach( function ( key ) {

                var type = uniformList[ key ];
                var func = Uniform[ type ];
                uniforms[ key ] = func( this.getUniformName( key ) );

            }.bind( this ) );

            obj.uniforms[ typeMember ] = new Map( uniforms );

            return obj.uniforms[ typeMember ];
        },

        getExtensions: function () {
            var algo = this.getAlgorithm();
            if ( algo === 'PCF' ) {
                return [];
                // looks like derivative is broken on some mac + intel cg ...
                // return [ '#extension GL_OES_standard_derivatives : enable' ];
            } else {
                return [];
            }
        },

        // Here to be common between  caster and receiver
        // (used by shadowMap and shadow node shader)
        getDefines: function () {

            var textureType = this.getPrecision();
            var algo = this.getAlgorithm();
            var defines = [];

            var isFloat = false;
            var isLinearFloat = false;

            if ( textureType !== 'UNSIGNED_BYTE' )
                isFloat = true;

            if ( isFloat && ( textureType === 'HALF_FLOAT_LINEAR' || textureType === 'FLOAT_LINEAR' ) )
                isLinearFloat = true;


            if ( algo === 'ESM' ) {
                defines.push( '#define _ESM' );
            } else if ( algo === 'NONE' ) {
                defines.push( '#define _NONE' );
            } else if ( algo === 'PCF' ) {
                defines.push( '#define _PCF' );
                var pcf = this.getKernelSizePCF();

                if ( this._fakePCF ) {
                    defines.push( '#define _FAKE_PCF 1' );
                }

                switch ( pcf ) {
                case '4Poisson(16texFetch)':
                    defines.push( '#define _POISSON_PCF' );
                    defines.push( '#define _PCFx4' );
                    break;
                case '8Poisson(32texFetch)':
                    defines.push( '#define _POISSON_PCF' );
                    defines.push( '#define _PCFx9' );
                    break;
                case '16Poisson(64texFetch)':
                    defines.push( '#define _POISSON_PCF' );
                    defines.push( '#define _PCFx16' );
                    break;
                case '25Poisson(100texFetch)':
                    defines.push( '#define _POISSON_PCF' );
                    defines.push( '#define _PCFx25' );
                    break;
                case '32Poisson(128texFetch)':
                    defines.push( '#define _POISSON_PCF' );
                    defines.push( '#define _PCFx32' );
                    break;
                case '1Band(1texFetch)':
                    defines.push( '#define _NONE' );
                    defines.push( '#define _PCFx1' );
                    break;
                case '4Band(4texFetch)':
                    defines.push( '#define _BAND_PCF' );
                    defines.push( '#define _PCFx4' );
                    break;
                case '9Band(9texFetch)':
                    defines.push( '#define _BAND_PCF' );
                    defines.push( '#define _PCFx9' );
                    break;
                case '16Band(16texFetch)':
                    defines.push( '#define _BAND_PCF' );
                    defines.push( '#define _PCFx16' );
                    break;
                case '4Tap(16texFetch)':
                    defines.push( '#define _TAP_PCF' );
                    defines.push( '#define _PCFx4' );
                    break;
                case '9Tap(36texFetch)':
                    defines.push( '#define _TAP_PCF' );
                    defines.push( '#define _PCFx9' );
                    break;
                case '16Tap(64texFetch)':
                    defines.push( '#define _TAP_PCF' );
                    defines.push( '#define _PCFx25' );
                    break;
                default:
                case '1Tap(4texFetch)':
                    defines.push( '#define _TAP_PCF' );
                    defines.push( '#define _PCFx1' );
                    break;
                }
            } else if ( algo === 'VSM' ) {
                defines.push( '#define _VSM' );
            } else if ( algo === 'EVSM' ) {
                defines.push( '#define _EVSM' );
            }

            if ( isFloat ) {
                defines.push( '#define _FLOATTEX' );
            }
            if ( isLinearFloat ) {
                defines.push( '#define _FLOATLINEAR' );
            }

            if ( this.getRotateOffset() ) {
                defines.push( '#define _ROTATE_OFFSET' );
            }
            return defines;
        },

        apply: function ( /*state*/) {

            if ( !this._enable )
                return;

            var uniformMap = this.getOrCreateUniforms();

            uniformMap.bias.set( this._bias );
            uniformMap.exponent0.set( this._exponent0 );
            uniformMap.exponent1.set( this._exponent1 );
            uniformMap.epsilonVSM.set( this._epsilonVSM );

            this.setDirty( false );
        },

        // need a isEnabled to let the ShaderGenerator to filter
        // StateAttribute from the shader compilation
        isEnabled: function () {
            return this._enable;
        },
        // Deprecated methods, should be removed in the future
        isEnable: function () {
            Notify.log( 'ShadowAttribute.isEnable() is deprecated, use isEnabled() instead' );
            return this.isEnabled();
        },
        getHash: function () {

            return this.getTypeMember() + '_' + this.getAlgorithm() + '_' + this.getKernelSizePCF() + '_' + this.getFakePCF() + '_' + this.getRotateOffset();

        }

    } ), 'osgShadow', 'ShadowReceiveAttribute' );

    MACROUTILS.setTypeID( ShadowReceiveAttribute );

    return ShadowReceiveAttribute;
} );
