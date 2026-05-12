use rosc::{OscMessage, OscPacket, OscType};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, Runtime};
use tauri_plugin_store::StoreExt;
use tokio::net::UdpSocket;
use tokio::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OscArg {
    pub r#type: String,
    pub value: serde_json::Value,
}

impl OscArg {
    fn from_osc_type(arg: OscType) -> Self {
        match arg {
            OscType::Int(v) => OscArg {
                r#type: "int".to_string(),
                value: serde_json::Value::Number(v.into()),
            },
            OscType::Float(v) => OscArg {
                r#type: "float".to_string(),
                // Serialize as a double precision float json number
                value: serde_json::Value::Number(serde_json::Number::from_f64(v as f64).unwrap()),
            },
            OscType::String(v) => OscArg {
                r#type: "string".to_string(),
                value: serde_json::Value::String(v),
            },
            OscType::Blob(v) => OscArg {
                r#type: "blob".to_string(),
                // Simple byte array mapping
                value: serde_json::Value::Array(
                    v.into_iter()
                        .map(|b| serde_json::Value::Number(b.into()))
                        .collect(),
                ),
            },
            OscType::Time(v) => OscArg {
                r#type: "time".to_string(),
                value: serde_json::json!({
                    "seconds": v.seconds,
                    "fractional": v.fractional
                }),
            },
            OscType::Long(v) => OscArg {
                r#type: "long".to_string(),
                value: serde_json::Value::Number(v.into()),
            },
            OscType::Double(v) => OscArg {
                r#type: "double".to_string(),
                value: serde_json::Value::Number(serde_json::Number::from_f64(v).unwrap()),
            },
            OscType::Char(v) => OscArg {
                r#type: "char".to_string(),
                value: serde_json::Value::String(v.to_string()),
            },
            OscType::Color(v) => OscArg {
                r#type: "color".to_string(),
                value: serde_json::json!({
                    "red": v.red,
                    "green": v.green,
                    "blue": v.blue,
                    "alpha": v.alpha
                }),
            },
            OscType::Midi(v) => OscArg {
                r#type: "midi".to_string(),
                value: serde_json::json!({
                    "port": v.port,
                    "status": v.status,
                    "data1": v.data1,
                    "data2": v.data2
                }),
            },
            OscType::Bool(v) => OscArg {
                r#type: "bool".to_string(),
                value: serde_json::Value::Bool(v),
            },
            OscType::Array(v) => OscArg {
                r#type: "array".to_string(),
                value: serde_json::Value::Array(
                    v.content.into_iter()
                        .map(|a| serde_json::to_value(Self::from_osc_type(a)).unwrap())
                        .collect(),
                ),
            },
            OscType::Nil => OscArg {
                r#type: "nil".to_string(),
                value: serde_json::Value::Null,
            },
            OscType::Inf => OscArg {
                r#type: "inf".to_string(),
                value: serde_json::Value::Null,
            },
        }
    }

    fn to_osc_type(self) -> Option<OscType> {
        match self.r#type.as_str() {
            "int" => self.value.as_i64().map(|v| OscType::Int(v as i32)),
            "float" => self.value.as_f64().map(|v| OscType::Float(v as f32)),
            "string" => self.value.as_str().map(|v| OscType::String(v.to_string())),
            "blob" => self.value.as_array().map(|v| {
                OscType::Blob(
                    v.iter()
                        .filter_map(|b| b.as_u64().map(|u| u as u8))
                        .collect(),
                )
            }),
            "time" => self.value.as_object().and_then(|o| {
                let sec = o.get("seconds").and_then(|s| s.as_u64());
                let frac = o.get("fractional").and_then(|f| f.as_u64());
                match (sec, frac) {
                    (Some(s), Some(f)) => Some(OscType::Time(rosc::OscTime {
                        seconds: s as u32,
                        fractional: f as u32,
                    })),
                    _ => None,
                }
            }),
            "long" => self.value.as_i64().map(OscType::Long),
            "double" => self.value.as_f64().map(OscType::Double),
            "char" => self.value.as_str().and_then(|s| s.chars().next()).map(OscType::Char),
            "color" => self.value.as_object().and_then(|o| {
                let r = o.get("red").and_then(|v| v.as_u64());
                let g = o.get("green").and_then(|v| v.as_u64());
                let b = o.get("blue").and_then(|v| v.as_u64());
                let a = o.get("alpha").and_then(|v| v.as_u64());
                match (r, g, b, a) {
                    (Some(r), Some(g), Some(b), Some(a)) => Some(OscType::Color(rosc::OscColor {
                        red: r as u8,
                        green: g as u8,
                        blue: b as u8,
                        alpha: a as u8,
                    })),
                    _ => None,
                }
            }),
            "midi" => self.value.as_object().and_then(|o| {
                let p = o.get("port").and_then(|v| v.as_u64());
                let s = o.get("status").and_then(|v| v.as_u64());
                let d1 = o.get("data1").and_then(|v| v.as_u64());
                let d2 = o.get("data2").and_then(|v| v.as_u64());
                match (p, s, d1, d2) {
                    (Some(p), Some(s), Some(d1), Some(d2)) => Some(OscType::Midi(rosc::OscMidiMessage {
                        port: p as u8,
                        status: s as u8,
                        data1: d1 as u8,
                        data2: d2 as u8,
                    })),
                    _ => None,
                }
            }),
            "bool" => self.value.as_bool().map(OscType::Bool),
            "array" => self.value.as_array().map(|arr| {
                OscType::Array(rosc::OscArray {
                    content: arr
                        .iter()
                        .filter_map(|v| {
                            serde_json::from_value::<OscArg>(v.clone())
                                .ok()
                                .and_then(|arg| arg.to_osc_type())
                        })
                        .collect(),
                })
            }),
            "nil" => Some(OscType::Nil),
            "inf" => Some(OscType::Inf),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct OscEvent {
    pub address: String,
    pub args: Vec<OscArg>,
}

pub struct OscState {
    pub socket: Arc<Mutex<Option<UdpSocket>>>,
    pub target_host: String,
    pub target_port: u16,
}

#[tauri::command]
pub async fn send_osc(
    address: String,
    args: Vec<OscArg>,
    state: tauri::State<'_, OscState>,
) -> Result<(), String> {
    let osc_args: Vec<OscType> = args.into_iter().filter_map(|a| a.to_osc_type()).collect();
    let msg = rosc::encoder::encode(&OscPacket::Message(OscMessage {
        addr: address,
        args: osc_args,
    }))
    .map_err(|e| format!("Failed to encode OSC message: {}", e))?;

    let socket_guard = state.socket.lock().await;
    if let Some(socket) = &*socket_guard {
        let target_addr = format!("{}:{}", state.target_host, state.target_port);
        socket
            .send_to(&msg, target_addr)
            .await
            .map_err(|e| format!("Failed to send OSC message: {}", e))?;
    } else {
        return Err("OSC socket not initialized".to_string());
    }

    Ok(())
}

pub fn setup<R: Runtime>(app: &AppHandle<R>) -> Result<(), Box<dyn std::error::Error>> {
    let store = app.store("store.json")?;

    let receive_port = store
        .get("osc.receivePort")
        .and_then(|v| v.as_u64())
        .map(|v| v as u16)
        .unwrap_or(9000);

    let target_host = store
        .get("osc.targetHost")
        .and_then(|v| v.as_str().map(|s| s.to_string()))
        .unwrap_or_else(|| "127.0.0.1".to_string());

    let target_port = store
        .get("osc.targetPort")
        .and_then(|v| v.as_u64())
        .map(|v| v as u16)
        .unwrap_or(8000);

    let state = OscState {
        socket: Arc::new(Mutex::new(None)),
        target_host,
        target_port,
    };
    app.manage(state);

    let app_handle = app.clone();

    tauri::async_runtime::spawn(async move {
        match UdpSocket::bind(SocketAddr::from(([0, 0, 0, 0], receive_port))).await {
            Ok(socket) => {
                let state: tauri::State<'_, OscState> = app_handle.state();
                *state.socket.lock().await = Some(socket);

                let socket_ref = state.socket.clone();

                // listener loop
                loop {
                    let mut buf = [0u8; 65536];
                    let socket_guard = socket_ref.lock().await;
                    if let Some(ref sock) = *socket_guard {
                        match sock.recv_from(&mut buf).await {
                            Ok((size, _addr)) => {
                                if let Ok((_, packet)) = rosc::decoder::decode_udp(&buf[..size]) {
                                    match packet {
                                        OscPacket::Message(msg) => {
                                            let event = OscEvent {
                                                address: msg.addr,
                                                args: msg.args.into_iter().map(OscArg::from_osc_type).collect(),
                                            };
                                            let _ = app_handle.emit("osc://message", event);
                                        }
                                        OscPacket::Bundle(bundle) => {
                                            // Handle bundles if we ever want to, currently out of scope
                                            // But for safety let's just log or ignore
                                            for packet in bundle.content {
                                                if let OscPacket::Message(msg) = packet {
                                                    let event = OscEvent {
                                                        address: msg.addr,
                                                        args: msg.args.into_iter().map(OscArg::from_osc_type).collect(),
                                                    };
                                                    let _ = app_handle.emit("osc://message", event);
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            Err(e) => {
                                log::error!("OSC recv_from error: {}", e);
                            }
                        }
                    } else {
                        break;
                    }
                }
            }
            Err(e) => {
                log::error!("Failed to bind OSC UDP socket on port {}: {}", receive_port, e);
            }
        }
    });

    Ok(())
}
